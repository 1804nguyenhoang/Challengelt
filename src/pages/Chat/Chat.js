'use client';
import React, { useState, useEffect, useRef } from 'react';
import { databases, ID, Query, client, storage, DATABASE_ID, MESSAGES_ID, USERS_ID, BUCKET_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, DEFAULT_IMG } from '~/appwrite/config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faEdit,
    faEllipsisV,
    faPaperclip,
    faPaperPlane,
    faTimes,
    faTrash,
    faReply,
    faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '~/contexts/UserContext';
import { useContext, useCallback } from 'react';

// Hàm định dạng thời gian
const formatTime = (isoString) => {
    const date = new Date(isoString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

function Chat() {
    const { userId, displayName, setUnreadCount } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [userIdFromUrl, setUserIdFromUrl] = useState('');
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [latestMessages, setLatestMessages] = useState({});
    const [editingMessage, setEditingMessage] = useState(null);
    const [editMessageContent, setEditMessageContent] = useState('');
    const [messageOptions, setMessageOptions] = useState(null);
    const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingInitialMessages, setIsLoadingInitialMessages] = useState(false);
    const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState(null);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);
    const abortControllerRef = useRef(null);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [originalMessages, setOriginalMessages] = useState({});
    const [isChatView, setIsChatView] = useState(false);

    const fetchUnreadCount = useCallback(
        async (userId) => {
            try {
                const response = await databases.listDocuments(DATABASE_ID, MESSAGES_ID, [
                    Query.equal('receiverId', userId),
                    Query.equal('isRead', false),
                ]);
                const unreadMessages = response.documents.length;
                setUnreadCount(unreadMessages);
                localStorage.setItem(`messCount_${userId}`, unreadMessages);
                return unreadMessages;
            } catch (error) {
                console.error('Error fetching unread count:', error);
                return 0;
            }
        },
        [setUnreadCount],
    );

    // Lấy danh sách người dùng và tin nhắn chưa đọc
    useEffect(() => {
        if (!userId) return;
        let mounted = true;

        const fetchUsersAndData = async () => {
            setIsLoadingUsers(true);
            try {
                const [usersResponse, unreadMessagesResponse] = await Promise.all([
                    databases.listDocuments(DATABASE_ID, USERS_ID),
                    databases.listDocuments(DATABASE_ID, MESSAGES_ID, [
                        Query.equal('receiverId', userId),
                        Query.equal('isRead', false),
                    ]),
                ]);

                if (!mounted) return;

                const filteredUsers = usersResponse.documents.filter((user) => user.$id !== userId);
                setUsers(filteredUsers);

                const unreadCountsMap = {};
                unreadMessagesResponse.documents.forEach((msg) => {
                    unreadCountsMap[msg.senderId] = (unreadCountsMap[msg.senderId] || 0) + 1;
                });
                setUnreadCounts(unreadCountsMap);
            } catch (error) {
                console.error('Error fetching users and unread counts:', error);
            } finally {
                if (mounted) setIsLoadingUsers(false);
            }
        };

        fetchUsersAndData();
        return () => {
            mounted = false;
        };
    }, [userId]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const userIdParam = params.get('user') || '';
        setUserIdFromUrl(userIdParam);

        if (userIdParam && users.length > 0) {
            const foundUser = users.find((u) => u.$id === userIdParam);
            if (foundUser && foundUser.$id !== selectedUser?.$id) {
                setSelectedUser(foundUser);
                setIsChatView(true); // Chuyển sang chế độ chat khi có user từ URL
            }
        } else {
            // Nếu không có user trong URL, đặt lại trạng thái
            setSelectedUser(null);
            setIsChatView(false);
        }
    }, [location.search, users, selectedUser?.$id]);

    useEffect(() => {
        const fetchOriginalMessages = async () => {
            const replyToIds = messages
                .filter((msg) => msg.replyTo)
                .map((msg) => msg.replyTo)
                .filter((id, index, self) => self.indexOf(id) === index); // Loại bỏ trùng lặp

            if (replyToIds.length > 0) {
                try {
                    const responses = await Promise.all(
                        replyToIds.map((id) => databases.getDocument(DATABASE_ID, MESSAGES_ID, id)),
                    );
                    const originalMsgs = responses.reduce((acc, msg) => {
                        acc[msg.$id] = msg;
                        return acc;
                    }, {});
                    setOriginalMessages((prev) => ({ ...prev, ...originalMsgs }));
                } catch (error) {
                    console.error('Error fetching original messages:', error);
                }
            }
        };

        if (messages.length > 0) {
            fetchOriginalMessages();
        }
    }, [messages]);

    useEffect(() => {
        if (!userId || !selectedUser) {
            setMessages([]);
            setIsLoadingInitialMessages(false);
            return;
        }

        const mountedRef = { current: true };
        const controller = new AbortController();

        const fetchMessages = async () => {
            setIsLoadingInitialMessages(true);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = controller;

            try {
                const response = await databases.listDocuments(
                    DATABASE_ID,
                    MESSAGES_ID,
                    [
                        Query.or([
                            Query.and([Query.equal('senderId', userId), Query.equal('receiverId', selectedUser.$id)]),
                            Query.and([Query.equal('senderId', selectedUser.$id), Query.equal('receiverId', userId)]),
                        ]),
                        Query.orderDesc('createdAt'),
                        Query.limit(50),
                        Query.offset(0),
                    ],
                    { signal: controller.signal },
                );

                if (mountedRef.current) {
                    setMessages(response.documents.reverse());
                    setHasMore(response.documents.length === 50);
                }
                // Cuộn xuống cuối khi tải tin nhắn ban đầu
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error fetching messages:', error);
                }
            } finally {
                if (mountedRef.current) {
                    setIsLoadingInitialMessages(false);
                }
            }
        };

        fetchMessages();
        return () => {
            mountedRef.current = false;
            controller.abort();
        };
    }, [userId, selectedUser]);

    // Tải thêm tin nhắn khi offset thay đổi
    useEffect(() => {
        if (!userId || !selectedUser || offset === 0 || !hasMore || isLoadingMoreMessages) return;

        const fetchMoreMessages = async () => {
            setIsLoadingMoreMessages(true);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            const controller = new AbortController();
            abortControllerRef.current = controller;

            // Lưu vị trí cuộn hiện tại
            const container = messagesContainerRef.current;
            const scrollTopBefore = container.scrollTop;
            const scrollHeightBefore = container.scrollHeight;

            try {
                const response = await databases.listDocuments(
                    DATABASE_ID,
                    MESSAGES_ID,
                    [
                        Query.or([
                            Query.and([Query.equal('senderId', userId), Query.equal('receiverId', selectedUser.$id)]),
                            Query.and([Query.equal('senderId', selectedUser.$id), Query.equal('receiverId', userId)]),
                        ]),
                        Query.orderDesc('createdAt'),
                        Query.limit(50),
                        Query.offset(offset),
                    ],
                    { signal: controller.signal },
                );

                setMessages((prev) => {
                    const newMessages = response.documents.reverse();
                    setHasMore(response.documents.length === 50);
                    return [...newMessages, ...prev];
                });

                // Điều chỉnh vị trí cuộn sau khi thêm tin nhắn
                requestAnimationFrame(() => {
                    const scrollHeightAfter = container.scrollHeight;
                    const heightAdded = scrollHeightAfter - scrollHeightBefore;
                    container.scrollTop = scrollTopBefore + heightAdded;
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error fetching more messages:', error);
                }
            } finally {
                setIsLoadingMoreMessages(false);
            }
        };

        fetchMoreMessages();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [userId, selectedUser, offset, hasMore]);

    // Xử lý cuộn để tải thêm tin nhắn
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container || !hasMore || isLoadingMoreMessages) return;

        const handleScroll = () => {
            if (container.scrollTop === 0) {
                setOffset((prev) => prev + 50);
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [hasMore, isLoadingMoreMessages]);

    const selectUser = useCallback(
        async (user) => {
            if (selectedUser && selectedUser.$id === user.$id) {
                return;
            }
            setSelectedUser(user);
            setIsChatView(true);
            setMessages([]);
            setOffset(0);
            setHasMore(true);
            setIsLoadingInitialMessages(true);
            setIsLoadingMoreMessages(false);
            navigate(`/chat?user=${user.$id}`);

            // Đánh dấu tất cả tin nhắn từ user này là đã đọc và cập nhật unreadCount
            try {
                const unreadMessagesResponse = await databases.listDocuments(DATABASE_ID, MESSAGES_ID, [
                    Query.equal('senderId', user.$id),
                    Query.equal('receiverId', userId),
                    Query.equal('isRead', false),
                ]);
                await Promise.all(
                    unreadMessagesResponse.documents.map((msg) =>
                        databases.updateDocument(DATABASE_ID, MESSAGES_ID, msg.$id, { isRead: true }),
                    ),
                );

                setUnreadCounts((prev) => ({ ...prev, [user.$id]: 0 }));

                // Cập nhật lại tổng unreadCount trong Header
                const newTotalUnread = await fetchUnreadCount(userId); // Gọi lại để đồng bộ
                setUnreadCount(newTotalUnread);
            } catch (error) {
                console.error('Error marking messages as read:', error);
            }
        },
        [fetchUnreadCount, navigate, selectedUser, userId, setUnreadCount],
    );

    // Subscription thời gian thực
    useEffect(() => {
        if (!userId || !selectedUser) return;

        const unsubscribe = client.subscribe(
            `databases.${DATABASE_ID}.collections.${MESSAGES_ID}.documents`,
            (response) => {
                const { events, payload } = response;
                if (!payload) return;

                const chatId = payload.senderId === userId ? payload.receiverId : payload.senderId;
                const eventType = events[0];

                setLatestMessages((prev) => ({
                    ...prev,
                    [chatId]: payload,
                }));

                if (payload.receiverId === userId && !payload.isRead) {
                    setUnreadCounts((prev) => ({
                        ...prev,
                        [chatId]: (prev[chatId] || 0) + 1,
                    }));
                    fetchUnreadCount(userId);
                }

                setUsers((prev) => {
                    const index = prev.findIndex((u) => u.$id === chatId);
                    if (index === -1) return prev;
                    const updatedUsers = [...prev];
                    updatedUsers.unshift(updatedUsers.splice(index, 1)[0]);
                    return updatedUsers;
                });

                const isRelevant =
                    (payload.senderId === userId && payload.receiverId === selectedUser.$id) ||
                    (payload.senderId === selectedUser.$id && payload.receiverId === userId);

                if (!isRelevant) return;

                if (eventType.includes('create')) {
                    setMessages((prev) => (prev.some((msg) => msg.$id === payload.$id) ? prev : [...prev, payload]));
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                } else if (eventType.includes('update')) {
                    setMessages((prev) => prev.map((msg) => (msg.$id === payload.$id ? payload : msg)));
                    if (payload.isRead && payload.senderId === selectedUser.$id) {
                        setUnreadCounts((prev) => ({
                            ...prev,
                            [chatId]: Math.max((prev[chatId] || 0) - 1, 0),
                        }));
                        fetchUnreadCount(userId);
                    }
                } else if (eventType.includes('delete')) {
                    setMessages((prev) => prev.filter((msg) => msg.$id !== payload.$id));
                }
            },
        );

        return () => unsubscribe();
    }, [userId, selectedUser, fetchUnreadCount]);

    // Hàm xử lý tải file
    const handleFileUpload = async (file) => {
        if (!file || !selectedUser) return;

        setIsUploadingFile(true);
        try {
            // Tải file lên Appwrite Storage
            const response = await storage.createFile(
                BUCKET_ID, // Thay bằng ID của bucket bạn tạo trong Appwrite
                ID.unique(),
                file,
            );

            // Lấy URL của file
            const fileId = response.$id;
            const fileUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${response.$id}/view?project=${APPWRITE_PROJECT_ID}`;

            // Gửi tin nhắn với URL của file
            const newMessage = {
                senderId: userId,
                receiverId: selectedUser.$id,
                message: `Đã gửi file: ${file.name}`,
                attachmentUrl: fileUrl, // Thêm trường attachmentUrl để lưu URL file
                attachmentType: file.type.split('/')[0], // 'image', 'video', hoặc 'application'
                createdAt: new Date().toISOString(),
                senderName: displayName,
                isRead: false,
                fileId: fileId,
            };

            await databases.createDocument(DATABASE_ID, MESSAGES_ID, ID.unique(), newMessage);
        } catch (error) {
            console.error('Error uploading file:', error);
        } finally {
            setIsUploadingFile(false);
        }
    };

    // Lấy tin nhắn cuối cùng
    useEffect(() => {
        if (!userId) return;
        let mounted = true;

        const fetchLatestMessages = async () => {
            try {
                const response = await databases.listDocuments(DATABASE_ID, MESSAGES_ID, [
                    Query.orderDesc('createdAt'),
                    Query.limit(100),
                ]);

                if (!mounted) return;

                const latestMsgMap = response.documents.reduce((map, msg) => {
                    const chatId = msg.senderId === userId ? msg.receiverId : msg.senderId;
                    if (!map[chatId] || new Date(msg.createdAt) > new Date(map[chatId].createdAt)) {
                        map[chatId] = msg;
                    }
                    return map;
                }, {});

                setLatestMessages(latestMsgMap);
                setUsers((prev) =>
                    [...prev].sort(
                        (a, b) =>
                            new Date(latestMsgMap[b.$id]?.createdAt || 0).getTime() -
                            new Date(latestMsgMap[a.$id]?.createdAt || 0).getTime(),
                    ),
                );
            } catch (error) {
                console.error('Error fetching latest messages:', error);
            }
        };

        fetchLatestMessages();
        return () => {
            mounted = false;
        };
    }, [userId]);

    // Đóng menu tùy chọn khi click ngoài
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (messageOptions && !e.target.closest('.message-options') && !e.target.closest('.options-button')) {
                setMessageOptions(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [messageOptions]);

    const sendMessage = useCallback(async () => {
        if (!message.trim() || !selectedUser) return;
        setIsSendingMessage(true);
    
        const newMessage = {
            senderId: userId,
            receiverId: selectedUser.$id,
            message: message.trim(),
            createdAt: new Date().toISOString(),
            senderName: displayName,
            isRead: false,
            replyTo: replyingTo ? replyingTo.$id : null,
        };
    
        try {
            await databases.createDocument(DATABASE_ID, MESSAGES_ID, ID.unique(), newMessage);
            setMessage('');
            setReplyingTo(null);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSendingMessage(false);
            // Sử dụng setTimeout để đảm bảo focus được gọi sau khi DOM re-render
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                }
            }, 0);
        }
    }, [message, selectedUser, userId, displayName, replyingTo]);

    useEffect(() => {
        if (!isSendingMessage && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSendingMessage]);

    const updateMessage = useCallback(async () => {
        if (!editMessageContent.trim() || !editingMessage) return;

        try {
            await databases.updateDocument(DATABASE_ID, MESSAGES_ID, editingMessage.$id, {
                message: editMessageContent.trim(),
            });
            setEditingMessage(null);
            setIsEditingModalOpen(false);
            setEditMessageContent('');
        } catch (error) {
            console.error('Error updating message:', error);
        }
    }, [editMessageContent, editingMessage]);

    const deleteMessage = useCallback(
        (msgId, senderId) => {
            if (senderId !== userId) return;
            setMessageToDelete(msgId);
            setMessageOptions(null);
            setIsDeleteModalOpen(true);
        },
        [userId],
    );

    const confirmDeleteMessage = useCallback(async () => {
        if (!messageToDelete) return;

        try {
            // Lấy tin nhắn cần xóa để kiểm tra fileId
            const message = messages.find((msg) => msg.$id === messageToDelete);
            if (message && message.fileId) {
                // Xóa file trong Storage
                await storage.deleteFile(BUCKET_ID, message.fileId);
                console.log(`Deleted file ${message.fileId} from storage`);
            }

            // Xóa tin nhắn trong database
            await databases.deleteDocument(DATABASE_ID, MESSAGES_ID, messageToDelete);
            setIsDeleteModalOpen(false);
            setMessageToDelete(null);
        } catch (error) {
            console.error('Error deleting message or file:', error);
        }
    }, [messageToDelete, messages]);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Cuộn xuống tin nhắn mới nhất chỉ khi tải ban đầu
    useEffect(() => {
        if (messages.length > 0 && !isLoadingInitialMessages && !isLoadingMoreMessages) {
            // Chỉ cuộn xuống khi tải tin nhắn ban đầu, không cuộn khi tải thêm
            if (offset === 0) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages, isLoadingInitialMessages, isLoadingMoreMessages, offset]);

    return (
        <div className="container mt-6 mb-30 h-screen flex flex-col md:flex-row bg-gray-100">
            <div
                className={`w-full md:w-1/4 bg-white p-4 border-r overflow-y-auto ${
                    isChatView ? 'hidden md:block' : ''
                }`}
            >
                <h2 className="text-lg font-bold mb-4">Danh bạ</h2>
                {isLoadingUsers ? (
                    <p className="text-gray-500">Đang tải danh bạ...</p>
                ) : (
                    <ul>
                        {users.map((user) => (
                            <li
                                key={user.$id}
                                className={`p-3 cursor-pointer rounded-lg flex items-center gap-2 ${
                                    selectedUser?.$id === user.$id ? 'bg-[#ffbdbd]' : 'hover:bg-gray-200'
                                }`}
                                onClick={() => selectUser(user)}
                            >
                                <div className="flex items-center gap-2">
                                    <img
                                        src={
                                            user.imgUser ||
                                            DEFAULT_IMG
                                        }
                                        alt={user.displayName}
                                        className="w-14 h-14 rounded-full"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{user.displayName}</p>
                                        <p
                                            className={`text-gray-600 text-md truncate ${
                                                unreadCounts[user.$id] > 0 ? 'font-bold' : ''
                                            }`}
                                        >
                                            {latestMessages[user.$id]?.message || 'Chưa có tin nhắn'}
                                        </p>
                                    </div>
                                    {unreadCounts[user.$id] > 0 && (
                                        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                                            {unreadCounts[user.$id]}
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className={`w-full md:w-3/4 flex flex-col ${isChatView ? '' : 'hidden md:flex'}`}>
                <div className="flex sticky top-0 z-100 items-center bg-white p-4 border-b shadow-md">
                    {isChatView && selectedUser ? (
                        <>
                            <button
                                className="md:hidden text-4xl pl-3 pr-3 text-gray-600 mr-2"
                                onClick={() => {
                                    navigate('/chat');
                                }}
                            >
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </button>
                            <img
                                src={
                                    selectedUser.imgUser ||
                                    DEFAULT_IMG
                                }
                                alt={selectedUser.displayName}
                                className="w-14 h-14 rounded-full mr-2"
                            />
                            <p className="text-3xl font-bold truncate">{selectedUser.displayName}</p>
                        </>
                    ) : (
                        <p className="text-gray-500">Chọn một cuộc trò chuyện</p>
                    )}
                </div>
                <div
                    ref={messagesContainerRef}
                    className="flex-1 p-4 overflow-y-auto bg-gray-50 mb-[120px] md:mb-[55px] md:mt-[1px]"
                    style={{ maxHeight: 'calc(100vh - 190px)' }}
                >
                    {isLoadingInitialMessages ? (
                        <p className="text-gray-500 text-center">Đang tải tin nhắn...</p>
                    ) : messages.length === 0 ? (
                        <p className="text-gray-500 text-center">Chưa có tin nhắn</p>
                    ) : (
                        <>
                            {isLoadingMoreMessages && (
                                <p className="text-gray-500 text-center">Đang tải thêm tin nhắn...</p>
                            )}
                            {messages.map((msg) => (
                                <div
                                    key={msg.$id}
                                    className={`group mb-2 flex ${
                                        msg.senderId === userId ? 'justify-end' : 'justify-start'
                                    }`}
                                >
                                    <div className="relative max-w-[70%]">
                                        {/* Nút "Trả lời" cho tin nhắn của đối phương */}
                                        {msg.senderId !== userId && (
                                            <button
                                                className="absolute right-[-24px] top-1/2 -translate-y-1/2 p-1 hidden group-hover:block text-gray-600 hover:text-gray-800"
                                                onClick={() => setReplyingTo(msg)}
                                            >
                                                <FontAwesomeIcon icon={faReply} />
                                            </button>
                                        )}
                                        {/* Nút "Trả lời" cho tin nhắn của đối phương */}
                                        {msg.senderId === userId && (
                                            <button
                                                className="absolute left-[-40px] top-1/2 -translate-y-1/2 p-1 hidden group-hover:block text-gray-600 hover:text-gray-800 options-button"
                                                onClick={() => setReplyingTo(msg)}
                                            >
                                                <FontAwesomeIcon icon={faReply} />
                                            </button>
                                        )}
                                        {msg.senderId === userId && (
                                            <button
                                                className="absolute left-[-13px] top-1/2 -translate-y-1/2 p-1 hidden group-hover:block text-gray-600 hover:text-gray-800 options-button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMessageOptions(messageOptions === msg.$id ? null : msg.$id);
                                                }}
                                            >
                                                <FontAwesomeIcon icon={faEllipsisV} />
                                            </button>
                                        )}
                                        <div
                                            className={`p-3 rounded-lg shadow-md whitespace-pre-wrap break-words ${
                                                msg.senderId === userId ? 'bg-[#f86666] text-white' : 'bg-white'
                                            }`}
                                        >
                                            {msg.replyTo && originalMessages[msg.replyTo] && (
                                                <div className="bg-gray-100 p-2 rounded mb-1">
                                                    <p className="text-sm text-gray-600">
                                                        Trả lời: {originalMessages[msg.replyTo].message}
                                                    </p>
                                                </div>
                                            )}
                                            <p>{msg.message}</p>
                                            {/* Hiển thị file nếu có */}
                                            {msg.attachmentUrl && (
                                                <>
                                                    {msg.attachmentType === 'image' && (
                                                        <img
                                                            src={msg.attachmentUrl}
                                                            alt={`File đính kèm từ ${msg.senderName}`}
                                                            className="max-w-full mt-2 rounded"
                                                        />
                                                    )}
                                                    {msg.attachmentType === 'video' && (
                                                        <video
                                                            src={msg.attachmentUrl}
                                                            controls
                                                            className="max-w-full mt-2 rounded"
                                                        />
                                                    )}
                                                    {msg.attachmentType === 'application' && (
                                                        <a
                                                            href={msg.attachmentUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-500 underline mt-2 block"
                                                        >
                                                            Tải xuống file: {msg.message.split(': ')[1]}
                                                        </a>
                                                    )}
                                                </>
                                            )}
                                            <span
                                                className={`text-xs ${
                                                    msg.senderId === userId ? 'text-gray-200' : 'text-gray-500'
                                                }`}
                                            >
                                                {formatTime(msg.createdAt)}
                                            </span>
                                        </div>

                                        {messageOptions === msg.$id && msg.senderId === userId && (
                                            <div className="absolute top-0 right-full mr-2 bg-white shadow-md rounded-md p-2 w-32 z-10 message-options">
                                                <button
                                                    className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
                                                    onClick={() => {
                                                        setEditMessageContent(msg.message);
                                                        setEditingMessage(msg);
                                                        setIsEditingModalOpen(true);
                                                        setMessageOptions(null);
                                                    }}
                                                >
                                                    <FontAwesomeIcon icon={faEdit} className="mr-2" /> Sửa
                                                </button>
                                                <button
                                                    className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm text-red-600"
                                                    onClick={() => deleteMessage(msg.$id, msg.senderId)}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} className="mr-2" /> Xóa
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {selectedUser && (
                    <div className="p-4 border-t bg-white flex flex-col fixed bottom-[55px] w-full md:relative">
                        {replyingTo && (
                            <div className="bg-gray-200 p-2 rounded mb-2 flex justify-between items-center">
                                <p className="text-sm text-gray-600">Đang trả lời: {replyingTo.message}</p>
                                <button onClick={() => setReplyingTo(null)} className="text-red-500 text-sm">
                                    Hủy
                                </button>
                            </div>
                        )}
                        <div className="flex items-center">
                            <input
                                type="file"
                                id="fileInput"
                                style={{ display: 'none' }}
                                accept="image/*,video/*,.pdf,.doc,.docx"
                                onChange={(e) => handleFileUpload(e.target.files[0])}
                            />
                            <button
                                onClick={() => document.getElementById('fileInput').click()}
                                className="ml-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                            >
                                <FontAwesomeIcon icon={faPaperclip} />
                            </button>
                            <input
                                type="text"
                                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f86666]"
                                placeholder="Nhập tin nhắn..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                ref={inputRef}
                                disabled={isSendingMessage}
                            />
                            <button
                                onClick={sendMessage}
                                className="ml-2 px-4 py-2 bg-[#f86666] text-white rounded-lg hover:bg-[#f44d4d] flex items-center disabled:opacity-50"
                                disabled={!message.trim() || isSendingMessage}
                            >
                                {isSendingMessage ? (
                                    'Đang gửi...'
                                ) : (
                                    <>
                                        <FontAwesomeIcon icon={faPaperPlane} className="mr-2" /> Gửi
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {isEditingModalOpen && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                        <div className="bg-white p-5 rounded-lg shadow-lg w-96">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="text-xl font-bold">Chỉnh sửa tin nhắn</h3>
                                <button
                                    onClick={() => {
                                        setIsEditingModalOpen(false);
                                        setEditingMessage(null);
                                        setEditMessageContent('');
                                    }}
                                    className="text-gray-500 hover:text-gray-800"
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                            <textarea
                                className="w-full p-2 mt-4 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={editMessageContent}
                                onChange={(e) => setEditMessageContent(e.target.value)}
                                rows={3}
                            />
                            <button
                                onClick={updateMessage}
                                className="w-full mt-4 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                                disabled={!editMessageContent.trim()}
                            >
                                Lưu
                            </button>
                        </div>
                    </div>
                )}

                {isDeleteModalOpen && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                        <div className="bg-white p-5 rounded-lg shadow-lg w-96">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h3 className="text-xl font-bold">Xác nhận xóa</h3>
                                <button
                                    onClick={() => {
                                        setIsDeleteModalOpen(false);
                                        setMessageToDelete(null);
                                    }}
                                    className="text-gray-500 hover:text-gray-800"
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                            <p className="my-4">Bạn có chắc muốn xóa tin nhắn này không?</p>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setIsDeleteModalOpen(false);
                                        setMessageToDelete(null);
                                    }}
                                    className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={confirmDeleteMessage}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                >
                                    Xóa
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Chat;
