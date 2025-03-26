'use client';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
    databases,
    storage,
    account,
    Query,
    ID,
    DATABASE_ID,
    CHALLENGES_ID,
    PENDING_CHALLENGES_ID,
    NOTIFICATIONS_ID,
    USERS_ID,
    JOINED_CHALLENGES_ID,
    BUCKET_ID,
} from '~/appwrite/config';
import { Link, useNavigate } from 'react-router-dom';
import { useDebounce } from '~/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons';
import Skeleton from 'react-loading-skeleton';

function Admin() {
    const [activeTab, setActiveTab] = useState('');
    const [users, setUsers] = useState([]);
    const [challenges, setChallenges] = useState([]);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [editChallenge, setEditChallenge] = useState(null);
    const [previewImage, setPreviewImage] = useState('');
    const [pendingChallenges, setPendingChallenges] = useState([]);
    const [showPendingChallenges, setShowPendingChallenges] = useState(false);
    const navigate = useNavigate();
    const inputRef = useRef();

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const [searchUser, setSearchUser] = useState('');
    const [searchChallenge, setSearchChallenge] = useState('');
    const [searchVideo, setSearchVideo] = useState('');
    const debouncedSearchUser = useDebounce(searchUser, 700);
    const debouncedSearchChallenge = useDebounce(searchChallenge, 700);
    const debouncedSearchVideo = useDebounce(searchVideo, 700);

    const [selectedField, setSelectedField] = useState('Tất cả');

    useEffect(() => {
        const checkAdmin = async () => {
            try {
                const user = await account.get();
                if (user.labels?.includes('admin')) {
                    setIsAdmin(true);
                } else {
                    navigate('/');
                }
            } catch {
                navigate('/');
            }
        };
        checkAdmin();
    }, [navigate]);

    const fetchChallenges = useCallback(async () => {
        setLoading(true);
        setChallenges([]);
        try {
            const queries = [
                debouncedSearchChallenge ? Query.contains('nameChallenge', debouncedSearchChallenge) : null,
                Query.orderDesc('$createdAt'),
            ].filter(Boolean);
            const response = await databases.listDocuments(DATABASE_ID, CHALLENGES_ID, queries);
            setChallenges(response.documents);
        } catch (error) {
            console.error('Lỗi khi lấy thử thách:', error);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchChallenge]);

    const fetchPendingChallenges = useCallback(async () => {
        setLoading(true);
        setPendingChallenges([]);
        try {
            const response = await databases.listDocuments(DATABASE_ID, PENDING_CHALLENGES_ID, [
                Query.equal('status', 'pending'),
                Query.orderDesc('$createdAt'),
            ]);
            setPendingChallenges(response.documents);
        } catch (error) {
            console.error('Lỗi khi lấy thử thách chờ phê duyệt:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleApproveChallenge = useCallback(
        async (pendingChallenge) => {
            try {
                // Tạo thử thách mới trong collection "challenges"
                const newChallenge = await databases.createDocument(DATABASE_ID, CHALLENGES_ID, ID.unique(), {
                    nameChallenge: pendingChallenge.nameChallenge,
                    describe: pendingChallenge.describe,
                    field: pendingChallenge.field,
                    imgChallenge: pendingChallenge.imgChallenge,
                    fileImgId: pendingChallenge.fileImgId,
                    createdBy: pendingChallenge.createdBy,
                    idUserCreated: pendingChallenge.idUserCreated,
                    participants: 0,
                });

                // Xóa thử thách khỏi "pending_challenges"
                await databases.deleteDocument(DATABASE_ID, PENDING_CHALLENGES_ID, pendingChallenge.$id);

                // Cập nhật UI
                setPendingChallenges((prev) => prev.filter((c) => c.$id !== pendingChallenge.$id));
                setChallenges((prev) => [...prev, newChallenge]); // Sử dụng newChallenge thay vì pendingChallenge

                // Tạo thông báo cho người tạo thử thách
                await databases.createDocument(DATABASE_ID, NOTIFICATIONS_ID, ID.unique(), {
                    userId: pendingChallenge.idUserCreated, // ID của người tạo thử thách
                    message: `Admin đã phê duyệt thử thách của bạn: ${pendingChallenge.nameChallenge}.`,
                    challengeId: newChallenge.$id, // ID của thử thách mới
                    createdAt: new Date().toISOString(),
                });

                alert('Thử thách đã được phê duyệt và thông báo đã được gửi.');
            } catch (error) {
                console.error('Lỗi khi phê duyệt thử thách:', error);
                alert('Phê duyệt thử thách thất bại.');
            }
        },
        [setPendingChallenges, setChallenges],
    );

    const handleRejectChallenge = useCallback(
        async (pendingChallenge) => {
            if (!window.confirm('Bạn có chắc chắn muốn từ chối thử thách này không?')) return;

            try {
                // Xóa thử thách khỏi "pending_challenges"
                await databases.deleteDocument(DATABASE_ID, PENDING_CHALLENGES_ID, pendingChallenge.$id);

                // Cập nhật UI
                setPendingChallenges((prev) => prev.filter((c) => c.$id !== pendingChallenge.$id));

                // Tạo thông báo cho người tạo thử thách
                await databases.createDocument(DATABASE_ID, NOTIFICATIONS_ID, ID.unique(), {
                    userId: pendingChallenge.idUserCreated, // ID của người tạo thử thách
                    message: `Admin đã từ chối thử thách của bạn: ${pendingChallenge.nameChallenge}.`,
                    challengeId: pendingChallenge.$id, // ID của thử thách bị từ chối
                    createdAt: new Date().toISOString(),
                });

                alert('Thử thách đã bị từ chối và thông báo đã được gửi.');
            } catch (error) {
                console.error('Lỗi khi từ chối thử thách:', error);
                alert('Từ chối thử thách thất bại.');
            }
        },
        [setPendingChallenges],
    );

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setUsers([]);
        try {
            const queries = [
                debouncedSearchUser ? Query.contains('displayName', debouncedSearchUser) : null,
                Query.orderDesc('$createdAt'),
            ].filter(Boolean);
            const response = await databases.listDocuments(DATABASE_ID, USERS_ID, queries);
            setUsers(response.documents);
        } catch (error) {
            console.error('Lỗi khi lấy người dùng:', error);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchUser]);

    const fetchVideos = useCallback(async () => {
        setLoading(true);
        setVideos([]);
        try {
            const queries = [
                debouncedSearchVideo ? Query.contains('describe', debouncedSearchVideo) : null,
                Query.orderDesc('$createdAt'),
            ].filter(Boolean);
            const [videosResponse, challengesResponse] = await Promise.all([
                databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, queries),
                databases.listDocuments(DATABASE_ID, CHALLENGES_ID),
            ]);
            const challengesMap = Object.fromEntries(
                challengesResponse.documents.map((challenge) => [
                    challenge.$id,
                    { name: challenge.nameChallenge, field: challenge.field },
                ]),
            );
            const videosWithChallenges = videosResponse.documents.map((video) => ({
                ...video,
                challengeName: challengesMap[video.challengeId]?.name || 'Không xác định',
                challengeField: challengesMap[video.challengeId]?.field || 'Không xác định',
            }));
            setVideos(videosWithChallenges);
        } catch (error) {
            console.error('Lỗi khi lấy video:', error);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchVideo]);

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
    }, [activeTab, debouncedSearchUser, fetchUsers]);

    useEffect(() => {
        if (activeTab === 'challenges') {
            fetchChallenges();
            if (showPendingChallenges) fetchPendingChallenges();
        }
    }, [activeTab, debouncedSearchChallenge, fetchChallenges, showPendingChallenges, fetchPendingChallenges]);

    useEffect(() => {
        if (activeTab === 'videos') fetchVideos();
    }, [activeTab, debouncedSearchVideo, fetchVideos]);

    const handlePageChange = (page) => setCurrentPage(page);

    const getPaginatedData = (data) => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return data.slice(startIndex, endIndex);
    };

    const getPaginationButtons = (totalItems) => {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    };

    const handleDeleteUser = useCallback(async (userId) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;
        try {
            const [joinedChallenges, createdChallenges, userVideos] = await Promise.all([
                databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [Query.equal('idUserJoined', userId)]),
                databases.listDocuments(DATABASE_ID, CHALLENGES_ID, [Query.equal('idUserCreated', userId)]),
                databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [Query.equal('idUserJoined', userId)]),
            ]);

            const updateParticipantsPromises = joinedChallenges.documents.map(async (entry) => {
                const challengeData = await databases.getDocument(DATABASE_ID, CHALLENGES_ID, entry.challengeId);
                if (challengeData) {
                    const updatedParticipants = Math.max((challengeData.participants || 1) - 1, 0);
                    return databases.updateDocument(DATABASE_ID, CHALLENGES_ID, entry.challengeId, {
                        participants: updatedParticipants,
                    });
                }
            });

            const deleteVideoStoragePromises = [
                ...joinedChallenges.documents.map(
                    (entry) => entry.fileId && storage.deleteFile(BUCKET_ID, entry.fileId),
                ),
                ...userVideos.documents.map((video) => video.fileId && storage.deleteFile(BUCKET_ID, video.fileId)),
            ].filter(Boolean);

            const deleteDataPromises = [
                ...joinedChallenges.documents.map((entry) =>
                    databases.deleteDocument(DATABASE_ID, JOINED_CHALLENGES_ID, entry.$id),
                ),
                ...userVideos.documents.map((video) =>
                    databases.deleteDocument(DATABASE_ID, JOINED_CHALLENGES_ID, video.$id),
                ),
            ];

            const deleteChallengesPromises = createdChallenges.documents.map(async (challenge) => {
                if (challenge.fileImgId) await storage.deleteFile(BUCKET_ID, challenge.fileImgId);
                const joinedResponse = await databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [
                    Query.equal('challengeId', challenge.$id),
                ]);
                const deleteJoinedParticipants = joinedResponse.documents.map(async (entry) => {
                    if (entry.fileId) await storage.deleteFile(BUCKET_ID, entry.fileId);
                    await databases.deleteDocument(DATABASE_ID, JOINED_CHALLENGES_ID, entry.$id);
                });
                await Promise.all(deleteJoinedParticipants);
                return databases.deleteDocument(DATABASE_ID, CHALLENGES_ID, challenge.$id);
            });

            await Promise.all([
                ...updateParticipantsPromises,
                ...deleteVideoStoragePromises,
                ...deleteDataPromises,
                ...deleteChallengesPromises,
                databases.deleteDocument(DATABASE_ID, USERS_ID, userId),
            ]);

            setUsers((prev) => prev.filter((user) => user.$id !== userId));
            alert('Xóa người dùng và toàn bộ dữ liệu liên quan thành công.');
        } catch (error) {
            console.error('Lỗi khi xóa người dùng:', error);
        }
    }, []);

    const handleDeleteChallenge = useCallback(
        async (challenge) => {
            if (
                !challenge?.$id ||
                !window.confirm('Bạn có chắc chắn muốn xóa thử thách này và toàn bộ dữ liệu liên quan?')
            )
                return;
            try {
                const deleteFilePromises = challenge.fileImgId
                    ? [storage.deleteFile(BUCKET_ID, challenge.fileImgId)]
                    : [];
                const joinedResponse = await databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [
                    Query.equal('challengeId', challenge.$id),
                ]);
                if (joinedResponse?.documents.length > 0) {
                    joinedResponse.documents.forEach((entry) => {
                        if (entry.fileId) deleteFilePromises.push(storage.deleteFile(BUCKET_ID, entry.fileId));
                        deleteFilePromises.push(databases.deleteDocument(DATABASE_ID, JOINED_CHALLENGES_ID, entry.$id));
                    });
                }
                await Promise.allSettled(deleteFilePromises);
                await databases.deleteDocument(DATABASE_ID, CHALLENGES_ID, challenge.$id);
                setChallenges((prev) => prev.filter((c) => c.$id !== challenge.$id));
                alert('Xóa thử thách và tất cả dữ liệu liên quan thành công.');
            } catch (error) {
                console.error('Lỗi khi xóa thử thách:', error);
                alert('Có lỗi xảy ra khi xóa thử thách.');
            }
        },
        [setChallenges],
    );

    const handleEditChallenge = useCallback((challenge) => {
        setEditChallenge(challenge);
        setPreviewImage(challenge.imgChallenge);
    }, []);

    const handleSaveEditChallenge = useCallback(async () => {
        if (!editChallenge) return;
        setLoading(true);
        try {
            let imageUrl = editChallenge.imgChallenge;
            let newFileId = editChallenge.fileImgId;
            if (editChallenge.newImage) {
                if (editChallenge.fileImgId) {
                    try {
                        await storage.deleteFile(BUCKET_ID, editChallenge.fileImgId);
                    } catch (error) {
                        console.warn('Không tìm thấy file cũ hoặc lỗi khi xóa:', error);
                    }
                }
                const uploadResponse = await storage.createFile(BUCKET_ID, ID.unique(), editChallenge.newImage);
                imageUrl = storage.getFileView(BUCKET_ID, uploadResponse.$id);
                newFileId = uploadResponse.$id;
            }
            const updatedChallenge = {
                nameChallenge: editChallenge.nameChallenge,
                describe: editChallenge.describe,
                field: editChallenge.field,
                imgChallenge: imageUrl,
                fileImgId: newFileId,
            };
            await databases.updateDocument(DATABASE_ID, CHALLENGES_ID, editChallenge.$id, updatedChallenge);
            setChallenges((prev) => prev.map((c) => (c.$id === editChallenge.$id ? { ...c, ...updatedChallenge } : c)));
            setEditChallenge(null);
            alert('Cập nhật thử thách thành công!');
        } catch (error) {
            console.error('Lỗi khi cập nhật thử thách:', error);
            alert('Cập nhật thử thách thất bại, vui lòng thử lại!');
        } finally {
            setLoading(false);
        }
    }, [editChallenge, setChallenges]);

    const handleDeleteVideo = useCallback(async (video) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa video này?')) return;
        try {
            const deletePromises = [];
            if (video.fileId) deletePromises.push(storage.deleteFile(BUCKET_ID, video.fileId));
            deletePromises.push(databases.deleteDocument(DATABASE_ID, JOINED_CHALLENGES_ID, video.$id));
            const challengeData = await databases.getDocument(DATABASE_ID, CHALLENGES_ID, video.challengeId);
            const updatedParticipants = Math.max((challengeData.participants || 1) - 1, 0);
            deletePromises.push(
                databases.updateDocument(DATABASE_ID, CHALLENGES_ID, video.challengeId, {
                    participants: updatedParticipants,
                }),
            );
            const [userJoined, challengeOwner] = await Promise.all([
                databases.getDocument(DATABASE_ID, USERS_ID, video.idUserJoined),
                databases.getDocument(DATABASE_ID, USERS_ID, challengeData.idUserCreated),
            ]);
            deletePromises.push(
                databases.updateDocument(DATABASE_ID, USERS_ID, video.idUserJoined, {
                    points: Math.max((userJoined.points || 5) - 5, 0),
                }),
            );
            deletePromises.push(
                databases.updateDocument(DATABASE_ID, USERS_ID, challengeData.idUserCreated, {
                    points: Math.max((challengeOwner.points || 5) - 5, 0),
                }),
            );
            deletePromises.push(
                databases.createDocument(DATABASE_ID, NOTIFICATIONS_ID, ID.unique(), {
                    userId: challengeData.idUserCreated,
                    message: `${video.userName} đã rời khỏi thử thách: ${challengeData.nameChallenge}. Bạn bị trừ 5 điểm!`,
                    challengeId: video.challengeId,
                    createdAt: new Date().toISOString(),
                }),
            );
            await Promise.all(deletePromises);
            setVideos((prev) => prev.filter((v) => v.$id !== video.$id));
            alert('Xóa video thành công và cập nhật thử thách.');
        } catch (error) {
            console.error('Lỗi khi xóa video:', error);
            alert('Xóa video thất bại. Vui lòng thử lại.');
        }
    }, []);

    const handleClear = () => {
        setSearchUser('');
        setSearchChallenge('');
        setSearchVideo('');
        inputRef.current.focus();
    };

    const filteredChallenges = useMemo(() => {
        if (selectedField === 'Tất cả') return challenges;
        return challenges.filter((challenge) => challenge.field === selectedField);
    }, [challenges, selectedField]);

    if (!isAdmin) {
        return <p className="text-center text-red-500">Bạn không có quyền truy cập trang này.</p>;
    }

    return (
        <div className="container mt-6 mb-32 mx-auto p-6 bg-white rounded-lg shadow">
            <h1 className="text-4xl font-bold text-center mb-6">Admin Dashboard</h1>

            {/* Menu Điều Hướng - Chỉ hiển thị khi không xem thử thách chờ phê duyệt */}
            {!showPendingChallenges && (
                <div className="flex flex-col sm:flex-row sm:space-x-4 mb-6">
                    <button
                        className={`px-4 py-2 mb-2 sm:mb-0 rounded ${
                            activeTab === 'users' ? 'bg-[#f86666] text-white' : 'bg-gray-200'
                        }`}
                        onClick={() => {
                            setActiveTab('users');
                            fetchUsers();
                            setCurrentPage(1);
                        }}
                    >
                        Quản lý Người Dùng
                    </button>
                    <button
                        className={`px-4 py-2 mb-2 sm:mb-0 rounded ${
                            activeTab === 'challenges' ? 'bg-[#f86666] text-white' : 'bg-gray-200'
                        }`}
                        onClick={() => {
                            setActiveTab('challenges');
                            fetchChallenges();
                            setCurrentPage(1);
                        }}
                    >
                        Quản lý Thử Thách
                    </button>
                    <button
                        className={`px-4 py-2 mb-2 sm:mb-0 rounded ${
                            activeTab === 'videos' ? 'bg-[#f86666] text-white' : 'bg-gray-200'
                        }`}
                        onClick={() => {
                            setActiveTab('videos');
                            fetchVideos();
                            setCurrentPage(1);
                        }}
                    >
                        Quản lý Video
                    </button>
                </div>
            )}

            {/* Quản lý Người Dùng */}
            {activeTab === 'users' && !showPendingChallenges && (
                <div>
                    <h2 className="text-2xl font-semibold mb-4 text-center">Quản lý người dùng</h2>
                    <div className="flex-1">
                        <label className="w-full sm:w-[150px] text-lg">Tìm kiếm người dùng: </label>
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Tìm kiếm người dùng"
                                value={searchUser}
                                onChange={(e) => {
                                    setSearchUser(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {!!searchUser && (
                                <button
                                    onClick={handleClear}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                >
                                    <FontAwesomeIcon icon={faCircleXmark} />
                                </button>
                            )}
                        </div>
                    </div>
                    <ul className="space-y-4 mt-2">
                        {loading ? (
                            <Skeleton className="rounded-lg" count={6} height={72} />
                        ) : (
                            getPaginatedData(users).map((user) => (
                                <li
                                    key={user.$id}
                                    className="flex flex-col sm:flex-row bg-gray-100 p-4 rounded-lg shadow relative"
                                >
                                    <img
                                        src={
                                            user.imgUser ||
                                            'https://cloud.appwrite.io/v1/storage/buckets/678a12cf00133f89ab15/files/679f7b6c00277c0c36bd/view?project=678a0a09003d4f41cb57&mode=admin'
                                        }
                                        alt={user.displayName}
                                        className="w-12 h-12 rounded-full object-cover mb-2 sm:mb-0 sm:mr-3"
                                        loading="lazy"
                                    />
                                    <div>
                                        <p className="font-bold">{user.displayName}</p>
                                        <p className="text-xl">{user.gmail}</p>
                                    </div>
                                    <div className="absolute top-7 right-3">
                                        <Link to={`/profile/${user.$id}`}>
                                            <button className="bg-blue-500 text-white mr-2 px-4 py-2 rounded">
                                                Xem
                                            </button>
                                        </Link>
                                        <button
                                            className="bg-red-500 text-white px-4 py-2 rounded"
                                            onClick={() => handleDeleteUser(user.$id)}
                                        >
                                            Xóa
                                        </button>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                    <div className="flex justify-center mt-4">
                        {getPaginationButtons(users.length).map((page) => (
                            <button
                                key={page}
                                className={`px-3 py-1 mx-1 rounded ${
                                    currentPage === page ? 'bg-blue-500 text-white' : 'bg-gray-200'
                                }`}
                                onClick={() => handlePageChange(page)}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {/* Quản lý Thử Thách */}
            {activeTab === 'challenges' && !showPendingChallenges && (
                <div className="container mx-auto p-4 bg-white rounded-lg">
                    <h2 className="text-2xl font-semibold mb-4 text-center">Quản lý thử thách</h2>
                    <button
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
                        onClick={() => {
                            setShowPendingChallenges(true);
                            fetchPendingChallenges();
                        }}
                    >
                        Thử thách chờ phê duyệt
                    </button>
                    {editChallenge ? (
                        <div className="mt-6 p-6 bg-white rounded-lg shadow">
                            <h2 className="text-2xl font-semibold">Chỉnh sửa thử thách</h2>
                            <div className="mt-4 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center">
                                    <label className="w-full sm:w-32 leading-9 text-gray-700 mb-2 sm:mb-0">
                                        Tên thử thách:{' '}
                                    </label>
                                    <input
                                        type="text"
                                        value={editChallenge.nameChallenge}
                                        onChange={(e) =>
                                            setEditChallenge({ ...editChallenge, nameChallenge: e.target.value })
                                        }
                                        className="w-full p-2 border rounded"
                                        placeholder="Tên thử thách"
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center">
                                    <label className="w-full sm:w-32 leading-9 text-gray-700 mb-2 sm:mb-0">
                                        Mô tả:{' '}
                                    </label>
                                    <textarea
                                        value={editChallenge.describe}
                                        onChange={(e) =>
                                            setEditChallenge({ ...editChallenge, describe: e.target.value })
                                        }
                                        className="w-full p-2 border rounded"
                                        placeholder="Mô tả thử thách"
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center">
                                    <label className="w-full sm:w-32 leading-9 text-gray-700 mb-2 sm:mb-0">
                                        Lĩnh vực:{' '}
                                    </label>
                                    <select
                                        value={editChallenge.field}
                                        onChange={(e) => setEditChallenge({ ...editChallenge, field: e.target.value })}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="Thể thao">Thể thao</option>
                                        <option value="Đời sống">Đời sống</option>
                                        <option value="Học tập">Học tập</option>
                                        <option value="Nấu ăn">Nấu ăn</option>
                                        <option value="Sáng tạo">Sáng tạo</option>
                                        <option value="Nghệ thuật">Nghệ thuật</option>
                                        <option value="Kinh doanh">Kinh doanh</option>
                                        <option value="Khoa học">Khoa học</option>
                                        <option value="Văn hóa">Văn hóa</option>
                                    </select>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center">
                                    <label className="w-full sm:w-32 leading-9 text-gray-700 mb-2 sm:mb-0">
                                        Ảnh thử thách:{' '}
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            setEditChallenge({ ...editChallenge, newImage: e.target.files[0] });
                                            setPreviewImage(URL.createObjectURL(e.target.files[0]));
                                        }}
                                        className="w-full p-2"
                                    />
                                </div>
                                {previewImage && (
                                    <img src={previewImage} alt="Preview" className="w-48 h-32 mt-2 rounded" />
                                )}
                                <div className="flex flex-col sm:flex-row sm:space-x-2 mt-4">
                                    <button
                                        className="bg-green-500 text-white px-4 py-2 rounded mb-2 sm:mb-0"
                                        onClick={handleSaveEditChallenge}
                                    >
                                        Lưu
                                    </button>
                                    <button
                                        className="bg-gray-500 text-white px-4 py-2 rounded mb-2 sm:mb-0"
                                        onClick={() => setEditChallenge(null)}
                                    >
                                        Hủy
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex-1 mb-2 md:mb-0 md:mr-4">
                                <label className="w-full sm:w-[150px] text-lg">Tìm kiếm thử thách: </label>
                                <div className="relative">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="Tìm kiếm thử thách"
                                        value={searchChallenge}
                                        onChange={(e) => {
                                            setSearchChallenge(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {!!searchChallenge && (
                                        <button
                                            onClick={handleClear}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
                                        >
                                            <FontAwesomeIcon icon={faCircleXmark} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="w-full sm:w-[150px] text-lg">Lọc theo lĩnh vực:</label>
                                <select
                                    value={selectedField}
                                    onChange={(e) => {
                                        setSelectedField(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="Tất cả">Tất cả</option>
                                    <option value="Thể thao">Thể thao</option>
                                    <option value="Đời sống">Đời sống</option>
                                    <option value="Học tập">Học tập</option>
                                    <option value="Nấu ăn">Nấu ăn</option>
                                    <option value="Sáng tạo">Sáng tạo</option>
                                    <option value="Nghệ thuật">Nghệ thuật</option>
                                    <option value="Kinh doanh">Kinh doanh</option>
                                    <option value="Khoa học">Khoa học</option>
                                    <option value="Văn hóa">Văn hóa</option>
                                </select>
                            </div>
                            <ul className="space-y-4 mt-2">
                                {loading ? (
                                    <Skeleton className="rounded-lg" count={3} height={125} />
                                ) : (
                                    getPaginatedData(filteredChallenges).map((challenge) => (
                                        <li
                                            key={challenge.$id}
                                            className="flex flex-col md:flex-row bg-gray-100 p-4 rounded-lg shadow"
                                        >
                                            <img
                                                src={challenge.imgChallenge || 'https://via.placeholder.com/100'}
                                                alt="Thử thách"
                                                className="w-full md:w-[200px] h-[95px] object-cover rounded mb-2 md:mb-0 md:mr-4"
                                                loading="lazy"
                                            />
                                            <div className="flex-1">
                                                <p className="font-bold">
                                                    <span className="font-semibold">Tên thử thách:</span>{' '}
                                                    {challenge.nameChallenge}
                                                </p>
                                                <p className="text-sm md:text-base">
                                                    <span className="font-semibold">Mô tả:</span> {challenge.describe}
                                                </p>
                                                <p className="text-sm md:text-base">
                                                    <span className="font-semibold">Lĩnh vực:</span> {challenge.field}
                                                </p>
                                                <p className="text-sm md:text-base">
                                                    <span className="font-semibold">Số người tham gia:</span>{' '}
                                                    {challenge.participants}
                                                </p>
                                                <p className="text-sm md:text-base">
                                                    <span className="font-semibold">Tác giả:</span>{' '}
                                                    {challenge.createdBy}
                                                </p>
                                            </div>
                                            <div className="flex flex-col md:flex-row mt-2 md:mt-0 md:items-center md:space-x-2">
                                                <Link
                                                    className="bg-blue-500 text-white px-4 py-2 rounded mb-2 md:mb-0 text-center"
                                                    to={`/challenge/${challenge.$id}`}
                                                >
                                                    <button>Xem</button>
                                                </Link>
                                                <button
                                                    className="bg-yellow-500 text-white px-4 py-2 rounded mb-2 md:mb-0"
                                                    onClick={() => handleEditChallenge(challenge)}
                                                >
                                                    Sửa
                                                </button>
                                                <button
                                                    className="bg-red-500 text-white px-4 py-2 rounded mb-2 md:mb-0"
                                                    onClick={() => handleDeleteChallenge(challenge)}
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        </li>
                                    ))
                                )}
                            </ul>
                            <div className="flex justify-center mt-4">
                                {getPaginationButtons(challenges.length).map((page) => (
                                    <button
                                        key={page}
                                        className={`px-3 py-1 mx-1 rounded ${
                                            currentPage === page ? 'bg-blue-500 text-white' : 'bg-gray-200'
                                        }`}
                                        onClick={() => handlePageChange(page)}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Danh sách thử thách chờ phê duyệt */}
            {showPendingChallenges && (
                <div>
                    <h2 className="text-2xl font-semibold">Thử thách chờ phê duyệt</h2>
                    <button
                        className="mt-4 px-4 py-2 bg-gray-500 text-white rounded"
                        onClick={() => setShowPendingChallenges(false)}
                    >
                        Quay lại
                    </button>
                    <ul className="space-y-4 mt-6">
                        {loading ? (
                            <Skeleton className="rounded-lg" count={3} height={125} />
                        ) : (
                            pendingChallenges.map((challenge) => (
                                <li key={challenge.$id} className="flex bg-gray-100 p-4 rounded-lg shadow">
                                    <img
                                        src={challenge.imgChallenge || 'https://via.placeholder.com/100'}
                                        alt="Thử thách"
                                        className="mr-5 w-[200px] h-[95px] object-cover rounded"
                                        loading="lazy"
                                    />
                                    <div>
                                        <p className="font-bold">
                                            <span className="font-semibold">Tên thử thách:</span>{' '}
                                            {challenge.nameChallenge}
                                        </p>
                                        <p className="text-xl">
                                            <span className="font-semibold">Mô tả:</span> {challenge.describe}
                                        </p>
                                        <p className="text-xl">
                                            <span className="font-semibold">Lĩnh vực:</span> {challenge.field}
                                        </p>
                                        <p className="text-xl">
                                            <span className="font-semibold">Số người tham gia:</span>{' '}
                                            {challenge.participants}
                                        </p>
                                        <p className="text-xl">
                                            <span className="font-semibold">Tác giả:</span> {challenge.createdBy}
                                        </p>
                                    </div>
                                    <div className="ml-auto">
                                        <button
                                            className="bg-green-500 text-white mr-2 px-4 py-2 rounded"
                                            onClick={() => handleApproveChallenge(challenge)}
                                        >
                                            Đồng ý
                                        </button>
                                        <button
                                            className="bg-red-500 text-white px-4 py-2 rounded"
                                            onClick={() => handleRejectChallenge(challenge)}
                                        >
                                            Từ chối
                                        </button>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}

            {/* Quản lý Video */}
            {activeTab === 'videos' && !showPendingChallenges && (
                <div className="container mx-auto p-4 bg-white rounded-lg">
                    <h2 className="text-2xl font-semibold mb-4 text-center">Quản lý video</h2>
                    <div className="flex-1">
                        <label className="w-full sm:w-[150px] text-lg">Tìm kiếm video: </label>
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Nhập mô tả video"
                                value={searchVideo}
                                onChange={(e) => {
                                    setSearchVideo(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {!!searchVideo && (
                                <button onClick={handleClear}>
                                    <FontAwesomeIcon
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
                                        icon={faCircleXmark}
                                    />
                                </button>
                            )}
                        </div>
                    </div>
                    <ul className="space-y-4 mt-2">
                        {loading ? (
                            <Skeleton className="rounded-lg" count={3} height={233} />
                        ) : (
                            getPaginatedData(videos).map((video) => (
                                <li key={video.$id} className="flex relative bg-gray-100 p-4 rounded-lg shadow">
                                    <div>
                                        <div>
                                            <p className="font-bold">
                                                <span className="text-xl font-semibold">Tên thử thách:</span>{' '}
                                                {video.challengeName}
                                            </p>
                                            <p className="font-bold">
                                                <span className="text-xl font-semibold">Lĩnh vực:</span>{' '}
                                                {video.challengeField}
                                            </p>
                                        </div>
                                        <div className="flex">
                                            <video
                                                src={video.videoURL}
                                                controls
                                                className="w-[250px] h-[150px] mr-3 mt-2"
                                                loading="lazy"
                                            />
                                            <div className="mt-2">
                                                <p className="font-bold">
                                                    <span className="font-semibold">Người đăng:</span> {video.userName}
                                                </p>
                                                <p className="text-xl">
                                                    <span className="font-semibold">Mô tả:</span> {video.describe}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="absolute top-12 right-3 bg-red-500 text-white px-4 py-2 rounded"
                                        onClick={() => handleDeleteVideo(video)}
                                    >
                                        Xóa
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                    <div className="flex justify-center mt-4">
                        {getPaginationButtons(videos.length).map((page) => (
                            <button
                                key={page}
                                className={`px-3 py-1 mx-1 rounded ${
                                    currentPage === page ? 'bg-blue-500 text-white' : 'bg-gray-200'
                                }`}
                                onClick={() => handlePageChange(page)}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(Admin);
