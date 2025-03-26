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
    const [formData, setFormData] = useState({
        displayName: '',
        imgUserFile: null,
        newPassword: '',
        confirmPassword: '',
        currentPassword: '', // Thêm currentPassword vào formData
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

    const handleShowMoreCreatedChallenges = () => {
        setVisibleCreatedChallenges((prev) => prev + 5);
    };

    const handleShowMoreJoinedChallenges = () => {
        setVisibleJoinedChallenges((prev) => prev + 3);
    };

    const handleEditChallenge = (challenge) => {
        setEditingChallenge((prev) => (prev && prev.$id === challenge.$id ? null : challenge));
        setChallengeForm({
            nameChallenge: challenge.nameChallenge,
            field: challenge.field,
            describe: challenge.describe,
            imgChallenge: challenge.imgChallenge,
        });
    };

    const handleChallengeInputChange = (e) => {
        const { name, value } = e.target;
        setChallengeForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleChallengeImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setChallengeForm((prev) => ({ ...prev, imgChallenge: file }));
        }
    };

    const handleSaveChallengeChanges = async () => {
        if (!editingChallenge) return;

        setIsSavingChallenge(true);
        try {
            let imgChallengeUrl = editingChallenge.imgChallenge;

            // Nếu có ảnh mới thì tải lên
            if (challengeForm.imgChallenge instanceof File) {
                const fileResponse = await storage.createFile(BUCKET_ID, ID.unique(), challengeForm.imgChallenge);
                imgChallengeUrl = storage.getFileView(BUCKET_ID, fileResponse.$id).href; // Sử dụng $id từ fileResponse
            }

            // Cập nhật dữ liệu thử thách
            const updatedChallenge = await databases.updateDocument(DATABASE_ID, CHALLENGES_ID, editingChallenge.$id, {
                nameChallenge: challengeForm.nameChallenge,
                field: challengeForm.field,
                describe: challengeForm.describe,
                imgChallenge: imgChallengeUrl,
            });

            // Cập nhật danh sách thử thách
            setCreatedChallenges((prev) => prev.map((c) => (c.$id === updatedChallenge.$id ? updatedChallenge : c)));
            setEditingChallenge(null);
            alert('Cập nhật thử thách thành công!');
        } catch (error) {
            console.error('Lỗi khi cập nhật thử thách:', error);
            alert('Cập nhật thử thách thất bại!');
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
            'Bạn có chắc chắn muốn xóa thử thách này không? Hành động này không thể hoàn tác!',
        );
        if (!confirmDelete) return;

        try {
            await databases.deleteDocument(DATABASE_ID, CHALLENGES_ID, challengeId);
            setCreatedChallenges((prevChallenges) =>
                prevChallenges.filter((challenge) => challenge.$id !== challengeId),
            );
            alert('Xóa thử thách thành công!');
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

        try {
            const accountInfo = await account.get();
            if (!accountInfo) {
                setErrorMessage('Bạn cần đăng nhập để thực hiện thao tác này.');
                return;
            }

            let imgUserUrl = userData.imgUser;

            if (formData.imgUserFile) {
                const fileResponse = await storage.createFile(BUCKET_ID, ID.unique(), formData.imgUserFile);
                imgUserUrl = storage.getFileView(BUCKET_ID, fileResponse.$id).href;
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
            <div className="relative container mx-auto mt-8 mb-[90px] p-6 bg-white rounded-lg shadow">
                <div className="mt-6 flex justify-end absolute gap-2 top-14 right-3">
                    <Skeleton width={102} height={34} className="py-2 px-4 rounded" />
                    <Skeleton width={46} height={34} className="py-2 px-4 rounded" />
                </div>
                <div className="flex items-center">
                    <Skeleton circle={true} height={100} width={100} />
                    <Skeleton width={180} height={30} className="ml-4" />
                </div>
                <div className="mt-10">
                    <Skeleton width={152} height={23} />
                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <Skeleton className="p-4" width={402} height={69} />
                        <Skeleton className="p-4" width={402} height={69} />
                        <Skeleton className="p-4" width={402} height={69} />
                    </div>
                </div>
                <div className="mt-10">
                    <Skeleton width={100} height={18} />
                    <div className="mt-2 space-y-2">
                        <Skeleton className="p-3 mb-2" height={69} />
                        <Skeleton className="p-3 mb-2" height={69} />
                        <Skeleton className="p-3 mb-2" height={69} />
                        <Skeleton className="p-3 mb-2" height={69} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative container mx-auto mt-8 mb-[90px] p-6 bg-white rounded-lg shadow">
            <div className="mt-6 flex justify-end absolute gap-2 top-14 right-3">
                <button
                    className="bg-blue-500 text-white font-semibold py-2 px-4 rounded"
                    onClick={() => {
                        setIsEditing(true);
                        setFormData((prev) => ({ ...prev, displayName: userData.displayName }));
                    }}
                >
                    Sửa hồ sơ
                </button>
                <Tippy content="Đăng xuất">
                    <button className="bg-red-500 text-white font-semibold py-2 px-4 rounded" onClick={handleLogout}>
                        <FontAwesomeIcon icon={faRightFromBracket} />
                    </button>
                </Tippy>
            </div>
            <div className="flex items-center">
                <img
                    src={imgUserPreview}
                    alt="imgUser"
                    width={100}
                    height={100}
                    loading="lazy"
                    className="rounded-full shadow-md"
                />
                <h1 className="text-5xl font-bold ml-4">{userData.displayName}</h1>
            </div>

            {isEditing ? (
                <div className="mt-6">
                    <h2 className="text-2xl font-semibold">Chỉnh sửa thông tin</h2>
                    <div className="mt-4 space-y-4">
                        <div className="flex">
                            <label className="text-xl w-[80px] leading-[40px]">Tên hiển thị:</label>
                            <input
                                name="displayName"
                                value={formData.displayName}
                                onChange={handleInputChange}
                                placeholder="Tên hiển thị"
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="flex">
                            <label className="text-xl w-[80px] leading-[40px]">Ảnh đại diện:</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} className="w-full p-2" />
                        </div>
                        <button
                            className="bg-blue-500 px-4 py-2 text-white mt-4 rounded"
                            onClick={() => setIsChangingPassword(!isChangingPassword)}
                        >
                            {isChangingPassword ? 'Ẩn đổi mật khẩu' : 'Thay đổi mật khẩu'}
                        </button>
                        {isChangingPassword && (
                            <>
                                <div className="flex">
                                    <label className="text-xl w-[160px] leading-[40px]">Mật khẩu hiện tại:</label>
                                    <input
                                        name="currentPassword"
                                        value={formData.currentPassword}
                                        onChange={handleInputChange}
                                        placeholder="Mật khẩu hiện tại"
                                        className="w-full p-2 border rounded mt-2"
                                        type="password"
                                    />
                                </div>
                                <div className="flex">
                                    <label className="text-xl w-[160px] leading-[40px]">Mật khẩu mới:</label>
                                    <input
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleInputChange}
                                        placeholder="Mật khẩu mới"
                                        className="w-full p-2 border rounded mt-2"
                                        type="password"
                                    />
                                </div>
                                <div className="flex">
                                    <label className="text-xl w-[160px] leading-[40px]">Xác nhận mật khẩu mới:</label>
                                    <input
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        placeholder="Xác nhận mật khẩu mới"
                                        className="w-full p-2 border rounded mt-2"
                                        type="password"
                                    />
                                </div>
                            </>
                        )}
                        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
                        <div className="mt-6">
                            <button
                                className="bg-green-500 rounded mr-[10px] px-4 py-2 text-white"
                                onClick={handleSaveChanges}
                            >
                                Lưu
                            </button>
                            <button
                                className="bg-gray-400 rounded px-4 py-2 text-black"
                                onClick={() => setIsEditing(false)}
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mt-10">
                    <h2 className="text-3xl font-semibold">Thông tin cá nhân</h2>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="bg-gray-100 p-4 rounded-lg text-center">
                            <h3 className="font-bold">Thử thách đã tạo:</h3>
                            <p className="text-2xl">{createdChallenges.length || 0}</p>
                        </div>
                        <div className="bg-gray-100 p-4 rounded-lg text-center">
                            <h3 className="font-bold">Thử thách đã tham gia:</h3>
                            <p className="text-2xl">{joinedChallenges.length || 0}</p>
                        </div>
                        <div className="bg-gray-100 p-4 rounded-lg text-center">
                            <h3 className="font-bold">Điểm của bạn:</h3>
                            <p className="text-2xl">{userData.points || 0} điểm</p>
                        </div>
                    </div>

                    <div className="mt-10">
                        {editingChallenge ? (
                            <div className="mt-6">
                                <h2 className="text-2xl font-semibold">Chỉnh sửa thử thách</h2>
                                <div className="mt-4 space-y-4">
                                    <div className="flex">
                                        <label className="w-[135px] leading-[40px]">Tên thử thách:</label>
                                        <input
                                            name="nameChallenge"
                                            value={challengeForm.nameChallenge}
                                            onChange={handleChallengeInputChange}
                                            placeholder="Tên thử thách"
                                            className="w-full p-2 border rounded"
                                            disabled={isSavingChallenge}
                                        />
                                    </div>
                                    <div className="flex">
                                        <label className="w-[135px] leading-[40px]">Lĩnh vực:</label>
                                        <select
                                            name="field"
                                            value={challengeForm.field}
                                            onChange={handleChallengeInputChange}
                                            className="w-full p-2 border rounded"
                                            disabled={isSavingChallenge}
                                        >
                                            {fields.map((field) => (
                                                <option key={field} value={field}>
                                                    {field}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex">
                                        <label className="w-[135px] leading-[40px]">Mô tả:</label>
                                        <textarea
                                            name="describe"
                                            value={challengeForm.describe}
                                            onChange={handleChallengeInputChange}
                                            placeholder="Mô tả thử thách"
                                            className="w-full p-2 border rounded"
                                            disabled={isSavingChallenge}
                                        />
                                    </div>
                                    <div className="flex">
                                        <label className="w-[135px] leading-[40px]">Hình ảnh:</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleChallengeImageChange}
                                            className="w-full p-2"
                                            disabled={isSavingChallenge}
                                        />
                                    </div>
                                    {isSavingChallenge && <p className="text-center text-gray-500">Đang lưu...</p>}
                                    <button
                                        className={`bg-green-500 rounded px-4 py-2 text-white mr-2 ${
                                            isSavingChallenge ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                        onClick={handleSaveChallengeChanges}
                                        disabled={isSavingChallenge}
                                    >
                                        {isSavingChallenge ? 'Đang lưu...' : 'Lưu'}
                                    </button>
                                    <button
                                        className="bg-gray-400 rounded px-4 py-2 text-black"
                                        onClick={() => setEditingChallenge(null)}
                                        disabled={isSavingChallenge}
                                    >
                                        Hủy
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-xl mt-4 font-bold">Thử thách đã tạo:</h3>
                                <ul className="mt-2 space-y-2">
                                    {createdChallenges.length > 0 ? (
                                        createdChallenges.slice(0, visibleCreatedChallenges).map((challenge) => (
                                            <div className="relative" key={challenge.$id}>
                                                <Link
                                                    to={`/challenge/${challenge.$id}`}
                                                    className="flex items-center justify-between bg-white p-3 rounded-lg shadow"
                                                >
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
                                                <button
                                                    className="absolute top-8 right-24 bg-yellow-500 text-white px-3 py-1 rounded"
                                                    onClick={() => handleEditChallenge(challenge)}
                                                >
                                                    {editingChallenge?.$id === challenge.$id ? 'Đóng' : 'Sửa'}
                                                </button>
                                                <button
                                                    className="absolute top-8 right-3 bg-red-500 text-white px-3 py-1 rounded"
                                                    onClick={() => handleDeleteChallenge(challenge.$id)}
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <p>Không có thử thách nào được tạo.</p>
                                    )}
                                </ul>
                                {visibleCreatedChallenges < createdChallenges.length && (
                                    <button
                                        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
                                        onClick={handleShowMoreCreatedChallenges}
                                    >
                                        Xem thêm
                                    </button>
                                )}
                            </div>
                        )}

                        <h3 className="text-xl mt-4 font-bold">Thử thách đã tham gia:</h3>
                        <ul className="grid grid-cols-3 gap-4 mt-2">
                            {joinedChallenges.length > 0 ? (
                                joinedChallenges.slice(0, visibleJoinedChallenges).map((challenge) => (
                                    <div key={challenge.$id} className="relative">
                                        <button
                                            className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded"
                                            onClick={() => handleLeaveChallenge(challenge)}
                                        >
                                            Rời khỏi
                                        </button>
                                        <Link
                                            to={`/challenge/${challenge.$id}`}
                                            className="flex items-center justify-between bg-white p-4 rounded-lg shadow"
                                        >
                                            <div>
                                                <p className="font-bold">{challenge.nameChallenge}</p>
                                                <p className="text-sm text-gray-500">{challenge.field}</p>
                                                <p className="text-sm text-blue-500">
                                                    {challenge.participants} người tham gia
                                                </p>
                                                <video
                                                    src={challenge.userVideo}
                                                    controls
                                                    className="w-[300px] h-[200px] mt-2 rounded-lg"
                                                    loading="lazy"
                                                />
                                                <p className="text-gray-600 mt-2">Mô tả: {challenge.userDescribe}</p>
                                            </div>
                                        </Link>
                                    </div>
                                ))
                            ) : (
                                <p>Không có thử thách nào được tham gia.</p>
                            )}
                        </ul>
                        {visibleJoinedChallenges < joinedChallenges.length && (
                            <button
                                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
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
