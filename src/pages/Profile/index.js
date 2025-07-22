'use client';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    databases,
    storage,
    account,
    Query,
    ID,
    DATABASE_ID,
    USERS_ID,
    CHALLENGES_ID,
    JOINED_CHALLENGES_ID,
    DEFAULT_IMG,
    BUCKET_ID,
    NOTIFICATIONS_ID,
} from '~/appwrite/config';
import { UserContext } from '~/contexts/UserContext';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

const Profile = () => {
    const { userId, setUserId, displayName } = useContext(UserContext);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [createdChallenges, setCreatedChallenges] = useState([]);
    const [joinedChallenges, setJoinedChallenges] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false); // Thêm trạng thái loading cho lưu thông tin cá nhân
    const [formData, setFormData] = useState({
        displayName: '',
        imgUserFile: null,
        newPassword: '',
        confirmPassword: '',
        currentPassword: '',
    });
    const [imgUserPreview, setImgUserPreview] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const [isSavingChallenge, setIsSavingChallenge] = useState(false);
    const [editingChallenge, setEditingChallenge] = useState(null);
    const [challengeForm, setChallengeForm] = useState({
        nameChallenge: '',
        field: '',
        describe: '',
        imgChallenge: null,
    });
    const [challengeImgPreview, setChallengeImgPreview] = useState(''); // Thêm trạng thái xem trước ảnh thử thách
    const fields = useMemo(
        () => [
            'Thể thao',
            'Đời sống',
            'Học tập',
            'Nấu ăn',
            'Sáng tạo',
            'Nghệ thuật',
            'Kinh doanh',
            'Khoa học',
            'Văn hóa',
        ],
        [],
    );

    const [visibleCreatedChallenges, setVisibleCreatedChallenges] = useState(5);
    const [visibleJoinedChallenges, setVisibleJoinedChallenges] = useState(3);

    const fetchUserData = useCallback(async () => {
        setLoading(true);
        if (!userId) return;
        try {
            const userResponse = databases.getDocument(DATABASE_ID, USERS_ID, userId);
            const createdResponse = databases.listDocuments(DATABASE_ID, CHALLENGES_ID, [
                Query.equal('idUserCreated', userId),
            ]);
            const joinedResponse = databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [
                Query.equal('idUserJoined', userId),
            ]);

            const [user, created, joined] = await Promise.all([userResponse, createdResponse, joinedResponse]);
            setUserData(user);
            setCreatedChallenges(created.documents);
            const userImage = user.imgUser || DEFAULT_IMG;
            setImgUserPreview(userImage);

            const joinedChallengesData = await Promise.all(
                joined.documents.map(async (entry) => {
                    try {
                        const challengeData = await databases.getDocument(
                            DATABASE_ID,
                            CHALLENGES_ID,
                            entry.challengeId,
                        );
                        return {
                            ...challengeData,
                            userVideo: entry.videoURL,
                            userDescribe: entry.describe,
                            fileId: entry.fileId,
                        };
                    } catch (error) {
                        console.error('Lỗi khi lấy thông tin thử thách đã tham gia:', error);
                        return null;
                    }
                }),
            );

            setJoinedChallenges(joinedChallengesData.filter(Boolean));
        } catch (error) {
            console.error('Lỗi khi lấy thông tin người dùng:', error.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    const handleShowMoreCreatedChallenges = () => setVisibleCreatedChallenges((prev) => prev + 5);
    const handleShowMoreJoinedChallenges = () => setVisibleJoinedChallenges((prev) => prev + 3);

    const handleEditChallenge = (challenge) => {
        setEditingChallenge((prev) => (prev && prev.$id === challenge.$id ? null : challenge));
        setChallengeForm({
            nameChallenge: challenge.nameChallenge,
            field: challenge.field,
            describe: challenge.describe,
            imgChallenge: challenge.imgChallenge,
        });
        setChallengeImgPreview(challenge.imgChallenge); // Hiển thị ảnh hiện tại khi chỉnh sửa
    };

    const handleChallengeInputChange = (e) => {
        const { name, value } = e.target;
        setChallengeForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleChallengeImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setChallengeForm((prev) => ({ ...prev, imgChallenge: file }));
            setChallengeImgPreview(URL.createObjectURL(file)); // Xem trước ảnh mới
        }
    };

    const handleSaveChallengeChanges = async () => {
        if (!editingChallenge) return;

        // Kiểm tra tên thử thách và mô tả có bị trống không
        if (!challengeForm.nameChallenge.trim()) {
            alert('Tên thử thách không được để trống.');
            return;
        }
        // Kiểm tra tên thử thách và mô tả có bị trống không
        if (!challengeForm.describe.trim()) {
            alert('Mô tả không được để trống.');
            return;
        }

        setIsSavingChallenge(true);
        try {
            let imgChallengeUrl = editingChallenge.imgChallenge;
            let fileImgId = editingChallenge.fileImgId; // Giả sử bạn thêm trường fileImgId để lưu ID file

            // Kiểm tra và xử lý ảnh mới nếu có
            if (challengeForm.imgChallenge instanceof File) {
                try {
                    // Upload ảnh mới trước
                    const fileResponse = await storage.createFile(BUCKET_ID, ID.unique(), challengeForm.imgChallenge);
                    imgChallengeUrl = storage.getFileView(BUCKET_ID, fileResponse.$id);
                    fileImgId = fileResponse.$id;

                    // Xóa ảnh cũ nếu có sau khi upload thành công
                    if (editingChallenge.fileImgId) {
                        try {
                            await storage.deleteFile(BUCKET_ID, editingChallenge.fileImgId);
                        } catch (error) {
                            console.warn('Không thể xóa ảnh cũ của thử thách:', error);
                        }
                    }
                } catch (uploadError) {
                    console.error('Lỗi khi upload ảnh thử thách:', uploadError);
                    alert('Upload ảnh thử thách thất bại, vui lòng thử lại!');
                    setIsSavingChallenge(false);
                    return;
                }
            }

            // Tạo object chứa thông tin thử thách đã cập nhật
            const updatedChallenge = {
                nameChallenge: challengeForm.nameChallenge,
                field: challengeForm.field,
                describe: challengeForm.describe,
                imgChallenge: imgChallengeUrl,
                fileImgId: fileImgId, // Lưu ID file nếu bạn dùng
            };

            // Cập nhật document trong database
            try {
                const updatedDoc = await databases.updateDocument(
                    DATABASE_ID,
                    CHALLENGES_ID,
                    editingChallenge.$id,
                    updatedChallenge,
                );
                setCreatedChallenges((prev) => prev.map((c) => (c.$id === updatedDoc.$id ? updatedDoc : c)));
                setEditingChallenge(null);
                setChallengeImgPreview(''); // Reset xem trước
                alert('Cập nhật thử thách thành công!');
            } catch (updateError) {
                console.error('Lỗi khi cập nhật thông tin thử thách:', updateError);
                alert('Cập nhật thông tin thử thách thất bại, vui lòng thử lại!');
            }
        } catch (error) {
            console.error('Lỗi không xác định khi cập nhật thử thách:', error);
            alert('Đã xảy ra lỗi khi cập nhật thử thách, vui lòng thử lại!');
        } finally {
            setIsSavingChallenge(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleDeleteChallenge = async (challengeId) => {
        if (!challengeId) {
            alert('Không tìm thấy thử thách để xóa.');
            return;
        }
        const confirmDelete = window.confirm(
            'Bạn có chắc chắn muốn xóa thử thách này và toàn bộ dữ liệu liên quan không?',
        );
        if (!confirmDelete) return;

        try {
            // Lấy thông tin thử thách để kiểm tra file ảnh
            const challenge = await databases.getDocument(DATABASE_ID, CHALLENGES_ID, challengeId);

            // Xóa file ảnh của thử thách nếu có
            const deleteFilePromises = [];
            if (challenge.fileImgId) {
                deleteFilePromises.push(storage.deleteFile(BUCKET_ID, challenge.fileImgId));
            }

            // Lấy danh sách các người tham gia thử thách
            const joinedResponse = await databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [
                Query.equal('challengeId', challengeId),
            ]);

            // Xóa các file video và dữ liệu tham gia của người dùng
            if (joinedResponse?.documents.length > 0) {
                joinedResponse.documents.forEach((entry) => {
                    if (entry.fileId) {
                        deleteFilePromises.push(storage.deleteFile(BUCKET_ID, entry.fileId));
                    }
                    deleteFilePromises.push(databases.deleteDocument(DATABASE_ID, JOINED_CHALLENGES_ID, entry.$id));
                });
            }

            // Thực hiện tất cả các thao tác xóa file và dữ liệu
            await Promise.all(deleteFilePromises);

            // Xóa thử thách chính
            await databases.deleteDocument(DATABASE_ID, CHALLENGES_ID, challengeId);

            // Cập nhật danh sách thử thách đã tạo trong UI
            setCreatedChallenges((prevChallenges) =>
                prevChallenges.filter((challenge) => challenge.$id !== challengeId),
            );

            alert('Xóa thử thách và toàn bộ dữ liệu liên quan thành công!');
        } catch (error) {
            console.error('Lỗi khi xóa thử thách:', error.message);
            alert('Không thể xóa thử thách, vui lòng thử lại.');
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData((prev) => ({ ...prev, imgUserFile: file }));
            setImgUserPreview(URL.createObjectURL(file));
        }
    };

    const validatePassword = () => {
        if (!isChangingPassword) return true;
        if (!formData.newPassword) {
            setErrorMessage('Mật khẩu mới không được để trống.');
            return false;
        }
        if (formData.newPassword !== formData.confirmPassword) {
            setErrorMessage('Mật khẩu mới và xác nhận không khớp.');
            return false;
        }
        return true;
    };

    const handleSaveChanges = async () => {
        setErrorMessage('');
        if (!window.confirm('Bạn có chắc chắn muốn lưu những thay đổi này không?')) return;
        if (!validatePassword()) return;

        setIsSavingProfile(true); // Bật trạng thái loading
        try {
            const accountInfo = await account.get();
            if (!accountInfo) {
                setErrorMessage('Bạn cần đăng nhập để thực hiện thao tác này.');
                return;
            }

            let imgUserUrl = userData.imgUser;

            if (formData.imgUserFile) {
                const fileResponse = await storage.createFile(BUCKET_ID, ID.unique(), formData.imgUserFile);
                imgUserUrl = storage.getFileView(BUCKET_ID, fileResponse.$id);
            }

            await Promise.all([
                account.updateName(formData.displayName),
                isChangingPassword
                    ? account.updatePassword(formData.newPassword, formData.currentPassword)
                    : Promise.resolve(),
                databases.updateDocument(DATABASE_ID, USERS_ID, userId, {
                    displayName: formData.displayName,
                    imgUser: imgUserUrl,
                }),
            ]);

            const joinedChallengesResponse = await databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [
                Query.equal('idUserJoined', userId),
            ]);

            const updateJoinedChallenges = joinedChallengesResponse.documents.map((doc) =>
                databases.updateDocument(DATABASE_ID, JOINED_CHALLENGES_ID, doc.$id, {
                    userName: formData.displayName,
                }),
            );

            const createdChallengesResponse = await databases.listDocuments(DATABASE_ID, CHALLENGES_ID, [
                Query.equal('idUserCreated', userId),
            ]);

            const updateCreatedChallenges = createdChallengesResponse.documents.map((doc) =>
                databases.updateDocument(DATABASE_ID, CHALLENGES_ID, doc.$id, {
                    createdBy: formData.displayName,
                }),
            );

            await Promise.all([...updateJoinedChallenges, ...updateCreatedChallenges]);

            alert('Cập nhật thông tin thành công!');
            setUserData((prev) => ({ ...prev, displayName: formData.displayName, imgUser: imgUserUrl }));
            setFormData((prev) => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            }));
            setIsEditing(false);
            setIsChangingPassword(false);
        } catch (error) {
            console.error('Lỗi khi cập nhật thông tin:', error);
            setErrorMessage(error.message || 'Đã xảy ra lỗi khi cập nhật thông tin. Vui lòng thử lại.');
        } finally {
            setIsSavingProfile(false); // Tắt trạng thái loading
        }
    };

    const handleLeaveChallenge = useCallback(
        async (challenge) => {
            if (!window.confirm(`Bạn có chắc chắn muốn rời khỏi thử thách "${challenge.nameChallenge}" không?`)) {
                return;
            }

            try {
                const deleteFilePromise = challenge.fileId
                    ? storage.deleteFile(BUCKET_ID, challenge.fileId)
                    : Promise.resolve();

                const joinedChallengesQuery = await databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [
                    Query.equal('idUserJoined', userId),
                    Query.equal('challengeId', challenge.$id),
                ]);

                const joinedChallenge = joinedChallengesQuery.documents[0];
                if (!joinedChallenge) {
                    console.warn('Không tìm thấy dữ liệu tham gia, bỏ qua xóa');
                    return;
                }
                const deleteJoinedChallengePromise = databases.deleteDocument(
                    DATABASE_ID,
                    JOINED_CHALLENGES_ID,
                    joinedChallenge.$id,
                );

                const updatedParticipants = Math.max(challenge.participants - 1, 0);
                const updateChallengePromise = databases.updateDocument(DATABASE_ID, CHALLENGES_ID, challenge.$id, {
                    participants: updatedParticipants,
                });

                const updatePoints = async (targetUserId) => {
                    const userData = await databases.getDocument(DATABASE_ID, USERS_ID, targetUserId);
                    const newPoints = Math.max((userData.points || 0) - 5, 0);
                    return databases.updateDocument(DATABASE_ID, USERS_ID, targetUserId, {
                        points: newPoints,
                    });
                };

                const challengeData = challenge.idUserCreated
                    ? challenge
                    : await databases.getDocument(DATABASE_ID, CHALLENGES_ID, challenge.$id);
                const ownerId = challengeData.idUserCreated;

                const updatePointsPromises = [updatePoints(userId)];
                if (ownerId) updatePointsPromises.push(updatePoints(ownerId));

                const notificationPromise = databases.createDocument(DATABASE_ID, NOTIFICATIONS_ID, ID.unique(), {
                    userId: ownerId,
                    message: `${displayName} đã rời khỏi thử thách của bạn: ${challengeData.nameChallenge}. Bạn bị trừ 5 điểm!`,
                    challengeId: challenge.$id,
                    createdAt: new Date().toISOString(),
                });

                await Promise.all([
                    deleteFilePromise,
                    deleteJoinedChallengePromise,
                    updateChallengePromise,
                    ...updatePointsPromises,
                    notificationPromise,
                ]);

                setJoinedChallenges((prev) => prev.filter((c) => c.$id !== challenge.$id));
                alert('Bạn đã rời khỏi thử thách thành công!');
            } catch (error) {
                console.error('Lỗi khi rời khỏi thử thách:', error);
                alert('Không thể rời khỏi thử thách, vui lòng thử lại.');
            }
        },
        [userId, displayName],
    );

    const handleLogout = async () => {
        const confirmLogout = window.confirm('Bạn có chắc chắn muốn đăng xuất?');
        if (!confirmLogout) return;
        try {
            await account.deleteSession('current');
            setUserId(null);
            alert('Đăng xuất thành công!');
            navigate('/');
        } catch (error) {
            console.error('Lỗi khi đăng xuất:', error.message);
            alert('Đăng xuất thất bại, vui lòng thử lại.');
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto mt-8 mb-32 p-4 sm:p-6 bg-white rounded-lg shadow">
                <div className="flex flex-col sm:flex-row justify-end gap-2 mb-4">
                    <Skeleton width={102} height={34} />
                    <Skeleton width={46} height={34} />
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Skeleton circle={true} height={80} width={80} />
                    <Skeleton width={180} height={30} />
                </div>
                <div className="mt-6">
                    <Skeleton width={152} height={23} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <Skeleton height={69} />
                        <Skeleton height={69} />
                        <Skeleton height={69} />
                    </div>
                </div>
                <div className="mt-6">
                    <Skeleton width={100} height={18} />
                    <div className="mt-2 space-y-2">
                        <Skeleton height={69} />
                        <Skeleton height={69} />
                        <Skeleton height={69} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto mt-8 mb-32 p-4 sm:p-6 bg-white rounded-lg shadow relative">
            <div className="flex flex-col sm:flex-row justify-end gap-2 absolute top-4 right-4">
                <button
                    className="bg-blue-500 text-white font-semibold py-2 px-4 rounded hover:bg-blue-600"
                    onClick={() => {
                        setIsEditing(true);
                        setFormData((prev) => ({ ...prev, displayName: userData.displayName }));
                    }}
                >
                    Sửa hồ sơ
                </button>
                <Tippy content="Đăng xuất">
                    <button
                        className="bg-red-500 text-white font-semibold py-2 px-4 rounded hover:bg-red-600"
                        onClick={handleLogout}
                    >
                        <FontAwesomeIcon icon={faRightFromBracket} />
                    </button>
                </Tippy>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
                <img
                    src={imgUserPreview}
                    alt="User Avatar"
                    width={80}
                    height={80}
                    loading="lazy"
                    className="rounded-full shadow-md w-20 h-20 sm:w-24 sm:h-24 object-cover"
                />
                <h1 className="text-3xl sm:text-5xl font-bold">{userData.displayName}</h1>
            </div>

            {isEditing ? (
                <div className="mt-6">
                    <h2 className="text-xl sm:text-2xl font-semibold">Chỉnh sửa thông tin</h2>
                    <div className="mt-4 space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <label className="text-lg font-medium w-full sm:w-24">Tên hiển thị:</label>
                            <input
                                name="displayName"
                                value={formData.displayName}
                                onChange={handleInputChange}
                                placeholder="Tên hiển thị"
                                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSavingProfile}
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <label className="text-lg font-medium w-full sm:w-24">Ảnh đại diện:</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="w-full p-2"
                                disabled={isSavingProfile}
                            />
                        </div>
                        <button
                            className="bg-blue-500 px-4 py-2 text-white rounded hover:bg-blue-600"
                            onClick={() => setIsChangingPassword(!isChangingPassword)}
                            disabled={isSavingProfile}
                        >
                            {isChangingPassword ? 'Ẩn đổi mật khẩu' : 'Thay đổi mật khẩu'}
                        </button>
                        {isChangingPassword && (
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                    <label className="text-lg font-medium w-full sm:w-40">Mật khẩu hiện tại:</label>
                                    <input
                                        name="currentPassword"
                                        value={formData.currentPassword}
                                        onChange={handleInputChange}
                                        placeholder="Mật khẩu hiện tại"
                                        type="password"
                                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isSavingProfile}
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                    <label className="text-lg font-medium w-full sm:w-40">Mật khẩu mới:</label>
                                    <input
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleInputChange}
                                        placeholder="Mật khẩu mới"
                                        type="password"
                                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isSavingProfile}
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                    <label className="text-lg font-medium w-full sm:w-40">Xác nhận mật khẩu:</label>
                                    <input
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        placeholder="Xác nhận mật khẩu"
                                        type="password"
                                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={isSavingProfile}
                                    />
                                </div>
                            </div>
                        )}
                        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
                        <div className="flex gap-2">
                            <button
                                className={`bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ${
                                    isSavingProfile ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                onClick={handleSaveChanges}
                                disabled={isSavingProfile}
                            >
                                {isSavingProfile ? (
                                    <span className="flex items-center">
                                        <svg
                                            className="animate-spin h-5 w-5 mr-2 text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        Đang lưu...
                                    </span>
                                ) : (
                                    'Lưu'
                                )}
                            </button>
                            <button
                                className="bg-gray-400 text-black px-4 py-2 rounded hover:bg-gray-500"
                                onClick={() => setIsEditing(false)}
                                disabled={isSavingProfile}
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mt-8">
                    <h2 className="text-2xl sm:text-3xl font-semibold">Thông tin cá nhân</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <div className="bg-gray-100 p-4 rounded-lg text-center">
                            <h3 className="font-bold">Thử thách đã tạo</h3>
                            <p className="text-xl sm:text-2xl">{createdChallenges.length || 0}</p>
                        </div>
                        <div className="bg-gray-100 p-4 rounded-lg text-center">
                            <h3 className="font-bold">Thử thách đã tham gia</h3>
                            <p className="text-xl sm:text-2xl">{joinedChallenges.length || 0}</p>
                        </div>
                        <div className="bg-gray-100 p-4 rounded-lg text-center">
                            <h3 className="font-bold">Điểm của bạn</h3>
                            <p className="text-xl sm:text-2xl">{userData.points || 0} điểm</p>
                        </div>
                    </div>

                    <div className="mt-8">
                        {editingChallenge ? (
                            <div className="mt-6">
                                <h2 className="text-xl sm:text-2xl font-semibold">Chỉnh sửa thử thách</h2>
                                <div className="mt-4 space-y-4">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                        <label className="text-lg font-medium w-full sm:w-32">Tên thử thách:</label>
                                        <input
                                            name="nameChallenge"
                                            value={challengeForm.nameChallenge}
                                            onChange={handleChallengeInputChange}
                                            placeholder="Tên thử thách"
                                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={isSavingChallenge}
                                        />
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                        <label className="text-lg font-medium w-full sm:w-32">Lĩnh vực:</label>
                                        <select
                                            name="field"
                                            value={challengeForm.field}
                                            onChange={handleChallengeInputChange}
                                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={isSavingChallenge}
                                        >
                                            {fields.map((field) => (
                                                <option key={field} value={field}>
                                                    {field}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                        <label className="text-lg font-medium w-full sm:w-32">Mô tả:</label>
                                        <textarea
                                            name="describe"
                                            value={challengeForm.describe}
                                            onChange={handleChallengeInputChange}
                                            placeholder="Mô tả thử thách"
                                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            disabled={isSavingChallenge}
                                        />
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                        <label className="text-lg font-medium w-full sm:w-32">Hình ảnh:</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleChallengeImageChange}
                                            className="w-full p-2"
                                            disabled={isSavingChallenge}
                                        />
                                    </div>
                                    {challengeImgPreview && (
                                        <div className="mt-2">
                                            <img
                                                src={challengeImgPreview}
                                                alt="Challenge Preview"
                                                className="w-32 h-32 object-cover rounded-lg"
                                            />
                                        </div>
                                    )}
                                    {isSavingChallenge && <p className="text-gray-500 text-center">Đang lưu...</p>}
                                    <div className="flex gap-2">
                                        <button
                                            className={`bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ${
                                                isSavingChallenge ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                            onClick={handleSaveChallengeChanges}
                                            disabled={isSavingChallenge}
                                        >
                                            {isSavingChallenge ? 'Đang lưu...' : 'Lưu'}
                                        </button>
                                        <button
                                            className="bg-gray-400 text-black px-4 py-2 rounded hover:bg-gray-500"
                                            onClick={() => {
                                                setEditingChallenge(null);
                                                setChallengeImgPreview('');
                                            }}
                                            disabled={isSavingChallenge}
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold mt-4">Thử thách đã tạo:</h3>
                                <ul className="mt-2 space-y-2">
                                    {createdChallenges.length > 0 ? (
                                        createdChallenges.slice(0, visibleCreatedChallenges).map((challenge) => (
                                            <li
                                                key={challenge.$id}
                                                className="relative bg-white p-3 rounded-lg shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                                            >
                                                <Link
                                                    to={`/challenge/${challenge.$id}`}
                                                    className="flex items-center gap-4 w-full"
                                                >
                                                    {challenge.imgChallenge && (
                                                        <img
                                                            src={challenge.imgChallenge}
                                                            alt={challenge.nameChallenge}
                                                            className="w-16 h-16 object-cover rounded-lg"
                                                            loading="lazy"
                                                        />
                                                    )}
                                                    <div>
                                                        <p className="font-bold">{challenge.nameChallenge}</p>
                                                        <p className="text-sm text-gray-500">{challenge.field}</p>
                                                        <p className="text-sm text-blue-500">
                                                            {challenge.participants > 0
                                                                ? `${challenge.participants} người tham gia`
                                                                : 'Chưa có người tham gia'}
                                                        </p>
                                                    </div>
                                                </Link>
                                                <div className="flex gap-2 mt-2 sm:mt-0">
                                                    <button
                                                        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                                                        onClick={() => handleEditChallenge(challenge)}
                                                    >
                                                        {editingChallenge?.$id === challenge.$id ? 'Đóng' : 'Sửa'}
                                                    </button>
                                                    <button
                                                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                                                        onClick={() => handleDeleteChallenge(challenge.$id)}
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>
                                            </li>
                                        ))
                                    ) : (
                                        <p>Không có thử thách nào được tạo.</p>
                                    )}
                                </ul>
                                {visibleCreatedChallenges < createdChallenges.length && (
                                    <button
                                        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                        onClick={handleShowMoreCreatedChallenges}
                                    >
                                        Xem thêm
                                    </button>
                                )}
                            </div>
                        )}

                        <h3 className="text-lg sm:text-xl font-bold mt-6">Thử thách đã tham gia:</h3>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                            {joinedChallenges.length > 0 ? (
                                joinedChallenges.slice(0, visibleJoinedChallenges).map((challenge) => (
                                    <li key={challenge.$id} className="relative bg-white p-4 rounded-lg shadow">
                                        <button
                                            className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                                            onClick={() => handleLeaveChallenge(challenge)}
                                        >
                                            Rời khỏi
                                        </button>
                                        <Link to={`/challenge/${challenge.$id}`} className="block">
                                            <p className="font-bold">{challenge.nameChallenge}</p>
                                            <p className="text-sm text-gray-500">{challenge.field}</p>
                                            <p className="text-sm text-blue-500">
                                                {challenge.participants} người tham gia
                                            </p>
                                            <video
                                                src={challenge.userVideo}
                                                controls
                                                className="w-full h-48 mt-2 rounded-lg object-cover"
                                                loading="lazy"
                                            />
                                            <p className="text-gray-600 mt-2">Mô tả: {challenge.userDescribe}</p>
                                        </Link>
                                    </li>
                                ))
                            ) : (
                                <p>Không có thử thách nào được tham gia.</p>
                            )}
                        </ul>
                        {visibleJoinedChallenges < joinedChallenges.length && (
                            <button
                                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                onClick={handleShowMoreJoinedChallenges}
                            >
                                Xem thêm
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
