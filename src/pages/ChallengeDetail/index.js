'use client';
import React, { useEffect, useState, useContext, useCallback, useMemo, Suspense } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
    databases,
    Query,
    storage,
    ID,
    DATABASE_ID,
    COMMENTS_ID,
    USERS_ID,
    DEFAULT_IMG,
    CHALLENGES_ID,
    JOINED_CHALLENGES_ID,
    RATINGS_ID,
    LIKES_ID,
    NOTIFICATIONS_ID,
    BUCKET_ID,
} from '~/appwrite/config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faStar as solidStar, faHeart as solidHeart, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { faStar as regularStar, faHeart as regularHeart, faComment } from '@fortawesome/free-regular-svg-icons';
import { UserContext } from '~/contexts/UserContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import classNames from 'classnames/bind';
import styles from './ChallengeDetail.module.scss';

const cx = classNames.bind(styles);

// Component Participant
const Participant = React.memo(({ participant, userId, onLike, isLiking, onComment }) => {
    const likes = participant.likes || { count: 0, likedByUser: false };
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalComments, setTotalComments] = useState(0);
    const [showComments, setShowComments] = useState(false);
    const commentsPerPage = 5;

    const fetchComments = useCallback(async () => {
        setLoadingComments(true);
        try {
            const offset = (currentPage - 1) * commentsPerPage;
            const commentsResponse = await databases.listDocuments(DATABASE_ID, COMMENTS_ID, [
                Query.equal('participantId', participant.$id),
                Query.isNull('parentCommentId'),
                Query.limit(commentsPerPage),
                Query.offset(offset),
                Query.orderDesc('createdAt'),
            ]);
            setComments(commentsResponse.documents);
            setTotalComments(commentsResponse.total);
        } catch (error) {
            console.error('Lỗi khi tải bình luận:', error);
        } finally {
            setLoadingComments(false);
        }
    }, [participant.$id, currentPage]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handleSendComment = async () => {
        if (!newComment.trim()) return;
        try {
            const userDoc = await databases.getDocument(DATABASE_ID, USERS_ID, userId);
            const commentData = {
                participantId: participant.$id,
                userId,
                userName: userDoc.displayName || 'Người dùng',
                profilePicture: userDoc.imgUser || DEFAULT_IMG,
                commentText: newComment,
                createdAt: new Date().toISOString(),
                likes: 0,
                likedBy: [],
                parentCommentId: null,
            };
            const response = await databases.createDocument(DATABASE_ID, COMMENTS_ID, ID.unique(), commentData);
            setComments((prev) => [{ ...commentData, $id: response.$id }, ...prev]);
            setNewComment('');
            setTotalComments((prev) => prev + 1);
            onComment(participant.$id, participant.idUserJoined, participant.userName, newComment);
            setShowComments(true);
        } catch (error) {
            console.error('Lỗi khi gửi bình luận:', error);
            alert('Không thể gửi bình luận. Vui lòng thử lại.');
        }
    };

    const handleLikeComment = async (commentId) => {
        try {
            const commentDoc = await databases.getDocument(DATABASE_ID, COMMENTS_ID, commentId);
            const likedBy = commentDoc.likedBy || [];
            const hasLiked = likedBy.includes(userId);

            const updatedLikedBy = hasLiked ? likedBy.filter((id) => id !== userId) : [...likedBy, userId];
            await databases.updateDocument(DATABASE_ID, COMMENTS_ID, commentId, {
                likes: hasLiked ? commentDoc.likes - 1 : commentDoc.likes + 1,
                likedBy: updatedLikedBy,
            });
            setComments((prev) =>
                prev.map((comment) =>
                    comment.$id === commentId
                        ? { ...comment, likes: comment.likes + (hasLiked ? -1 : 1), likedBy: updatedLikedBy }
                        : comment,
                ),
            );
        } catch (error) {
            console.error('Lỗi khi thích bình luận:', error);
            alert('Không thể thích bình luận. Vui lòng thử lại.');
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
        try {
            await databases.deleteDocument(DATABASE_ID, COMMENTS_ID, commentId);
            setComments((prev) => prev.filter((comment) => comment.$id !== commentId));
            setTotalComments((prev) => prev - 1);
            alert('Bình luận đã được xóa.');
        } catch (error) {
            console.error('Lỗi khi xóa bình luận:', error);
            alert('Không thể xóa bình luận. Vui lòng thử lại.');
        }
    };

    const handleNextPage = () => {
        if (currentPage < Math.ceil(totalComments / commentsPerPage)) {
            setCurrentPage((prev) => prev + 1);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage((prev) => prev - 1);
        }
    };

    const formatTimestamp = (timestamp) => {
        const now = new Date();
        const commentTime = new Date(timestamp);
        const diffMinutes = Math.floor((now - commentTime) / 60000);
        return `${diffMinutes} phút trước`;
    };

    return (
        <div className="flex flex-col bg-gray-100 p-4 rounded-lg shadow">
            <p className="font-bold">{participant.userName}</p>
            <p className="text-gray-600">Mô tả: {participant.describe}</p>
            <video src={participant.videoURL} loading="lazy" controls className="w-full mt-2 rounded-lg" />
            <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon
                        icon={likes.likedByUser ? solidHeart : regularHeart}
                        className={`cursor-pointer text-lg ${
                            likes.likedByUser ? 'text-red-500' : 'text-gray-500'
                        } hover:text-red-600 ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={
                            !isLiking
                                ? () => onLike(participant.$id, participant.idUserJoined, participant.userName)
                                : null
                        }
                    />
                    <span className="text-gray-600">{likes.count}</span>
                </div>
                <button
                    onClick={() => setShowComments((prev) => !prev)}
                    className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors"
                >
                    <FontAwesomeIcon icon={faComment} />
                    <span>{totalComments} bình luận</span>
                </button>
            </div>
            {showComments && (
                <div className="mt-4">
                    <h3 className="font-semibold text-lg mb-3">Bình luận ({totalComments}):</h3>
                    {loadingComments ? (
                        <Skeleton count={commentsPerPage} height={50} />
                    ) : comments.length > 0 ? (
                        <>
                            {comments.map((comment) => (
                                <div key={comment.$id} className="flex items-start mb-4">
                                    <img
                                        src={comment.profilePicture}
                                        alt="Profile"
                                        className="w-10 h-10 rounded-full mr-3"
                                        loading="lazy"
                                    />
                                    <div className="flex-1">
                                        <div className="bg-gray-200 p-3 rounded-lg shadow-sm">
                                            <span className="font-semibold text-2xl text-gray-800">
                                                {comment.userName}
                                            </span>
                                            <p className="text-gray-700 text-xl mt-1">{comment.commentText}</p>
                                        </div>
                                        <div className="flex items-center mt-2 text-xs text-gray-500">
                                            <span className="mr-3">{formatTimestamp(comment.createdAt)}</span>
                                            <button
                                                onClick={() => handleLikeComment(comment.$id)}
                                                className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${
                                                    comment.likedBy?.includes(userId)
                                                        ? 'text-blue-600'
                                                        : 'text-gray-500'
                                                }`}
                                            >
                                                <span>THÍCH</span>
                                                <span>({comment.likes})</span>
                                            </button>
                                            {comment.userId === userId && (
                                                <button
                                                    onClick={() => handleDeleteComment(comment.$id)}
                                                    className="ml-3 text-red-500 hover:text-red-700 transition-colors"
                                                >
                                                    XÓA
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {totalComments > commentsPerPage && (
                                <div className="mt-4 flex justify-between items-center">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 1}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            currentPage === 1
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-blue-500 text-white hover:bg-blue-600'
                                        }`}
                                    >
                                        Trang trước
                                    </button>
                                    <span className="text-gray-600 text-sm">
                                        Trang {currentPage} / {Math.ceil(totalComments / commentsPerPage)}
                                    </span>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={currentPage === Math.ceil(totalComments / commentsPerPage)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            currentPage === Math.ceil(totalComments / commentsPerPage)
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-blue-500 text-white hover:bg-blue-600'
                                        }`}
                                    >
                                        Trang sau
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-gray-500 text-sm">Chưa có bình luận nào.</p>
                    )}
                    <div className="mt-4 flex items-center gap-3">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Nhập bình luận..."
                            className="flex-1 p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            onKeyPress={(e) => e.key === 'Enter' && handleSendComment()}
                        />
                        <button
                            onClick={handleSendComment}
                            className="text-gray-500 hover:text-blue-600 transition-colors"
                        >
                            <FontAwesomeIcon icon={faPaperPlane} className="text-lg" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

// Component ChallengeDetail
function ChallengeDetail() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { userId } = useContext(UserContext);
    const [challenge, setChallenge] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [hasJoined, setHasJoined] = useState(false);
    const [visibleParticipants, setVisibleParticipants] = useState(3);
    const [loading, setLoading] = useState(true);
    const [userRating, setUserRating] = useState(0);
    const [averageRating, setAverageRating] = useState(0);
    const [ratingCount, setRatingCount] = useState(0);
    const [isRatingLoading, setIsRatingLoading] = useState(false);
    const [likes, setLikes] = useState({});
    const [isLiking, setIsLiking] = useState({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [challengeResponse, participantsResponse, ratingsResponse, likesResponse] = await Promise.all([
                databases.getDocument(DATABASE_ID, CHALLENGES_ID, id),
                databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [Query.equal('challengeId', id)]),
                databases.listDocuments(DATABASE_ID, RATINGS_ID, [Query.equal('challengeId', id)]),
                databases.listDocuments(DATABASE_ID, LIKES_ID, [Query.equal('challengeId', id)]),
            ]);

            const participantsData = participantsResponse.documents;
            const ratings = ratingsResponse.documents;
            const userRatingDoc = ratings.find((r) => r.userId === userId);
            const avgRating =
                ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1) : 0;
            const initialLikes = {};
            participantsData.forEach((participant) => {
                const participantLikes = likesResponse.documents.filter(
                    (like) => like.participantId === participant.$id,
                );
                initialLikes[participant.$id] = {
                    count: participantLikes.length,
                    likedByUser: participantLikes.some((like) => like.userId === userId),
                };
            });

            setChallenge(challengeResponse);
            setParticipants(participantsData);
            setHasJoined(participantsData.some((p) => p.idUserJoined === userId));
            setUserRating(userRatingDoc ? userRatingDoc.rating : 0);
            setAverageRating(avgRating);
            setRatingCount(ratings.length);
            setLikes(initialLikes);
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu:', error);
            alert('Không thể tải thông tin thử thách. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    }, [id, userId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleShowMoreParticipants = useCallback(() => setVisibleParticipants((prev) => prev + 3), []);
    const handleShowLessParticipants = useCallback(() => setVisibleParticipants(3), []);

    const handleRating = useCallback(
        async (rating) => {
            if (!hasJoined) {
                alert('Bạn cần tham gia thử thách để có thể đánh giá!');
                return;
            }
            setIsRatingLoading(true);
            try {
                const existingRating = await databases.listDocuments(DATABASE_ID, RATINGS_ID, [
                    Query.equal('challengeId', id),
                    Query.equal('userId', userId),
                ]);
                const ratingData = { challengeId: id, userId, rating, createdAt: new Date().toISOString() };
                const isNewRating = existingRating.documents.length === 0;

                await (isNewRating
                    ? databases.createDocument(DATABASE_ID, RATINGS_ID, ID.unique(), ratingData)
                    : databases.updateDocument(DATABASE_ID, RATINGS_ID, existingRating.documents[0].$id, { rating }));

                const ratingsResponse = await databases.listDocuments(DATABASE_ID, RATINGS_ID, [
                    Query.equal('challengeId', id),
                ]);
                const ratings = ratingsResponse.documents;
                const avgRating =
                    ratings.length > 0
                        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
                        : 0;

                const userDoc = await databases.getDocument(DATABASE_ID, USERS_ID, userId);
                await databases.createDocument(DATABASE_ID, NOTIFICATIONS_ID, ID.unique(), {
                    userId: challenge.idUserCreated,
                    message: `${userDoc.displayName} đã đánh giá thử thách "${challenge.nameChallenge}" của bạn ${rating} sao! Điểm trung bình hiện tại: ${avgRating}.`,
                    challengeId: id,
                    createdAt: new Date().toISOString(),
                });

                setUserRating(rating);
                setAverageRating(avgRating);
                setRatingCount(ratings.length);
                alert('Đánh giá của bạn đã được ghi nhận!');
            } catch (error) {
                console.error('Lỗi khi lưu đánh giá:', error);
                alert('Không thể lưu đánh giá. Vui lòng thử lại.');
            } finally {
                setIsRatingLoading(false);
            }
        },
        [id, userId, hasJoined, challenge],
    );

    const handleLeaveChallenge = useCallback(async () => {
        if (!window.confirm('Bạn có chắc chắn muốn rời khỏi thử thách này?')) return;
        setLoading(true);
        try {
            const participant = participants.find((p) => p.idUserJoined === userId);
            if (!participant) throw new Error('Bạn chưa tham gia thử thách này!');

            await Promise.all([
                participant.fileId && storage.deleteFile(BUCKET_ID, participant.fileId),
                databases.deleteDocument(DATABASE_ID, JOINED_CHALLENGES_ID, participant.$id),
            ]);

            const updatedParticipants = Math.max((challenge.participants || 1) - 1, 0);
            await databases.updateDocument(DATABASE_ID, CHALLENGES_ID, id, {
                participants: updatedParticipants,
            });

            const userDoc = await databases.getDocument(DATABASE_ID, USERS_ID, userId);
            await databases.createDocument(DATABASE_ID, NOTIFICATIONS_ID, ID.unique(), {
                userId: challenge.idUserCreated,
                message: `${userDoc.displayName} đã rời khỏi thử thách "${challenge.nameChallenge}".`,
                challengeId: id,
                createdAt: new Date().toISOString(),
            });

            setHasJoined(false);
            setParticipants((prev) => prev.filter((p) => p.$id !== participant.$id));
            setChallenge((prev) => ({ ...prev, participants: updatedParticipants }));
            alert('Bạn đã rời khỏi thử thách.');
        } catch (error) {
            console.error('Lỗi khi rời thử thách:', error);
            alert('Không thể rời thử thách. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [id, userId, participants, challenge]);

    const handleLike = useCallback(
        (participantId, participantUserId, participantUserName) => {
            if (!userId) {
                alert('Bạn cần đăng nhập để thả tim!');
                return;
            }
            if (participantUserId === userId) {
                alert('Bạn không thể thả tim cho video của chính mình!');
                return;
            }
            if (isLiking[participantId]) return;

            const currentLikes = likes[participantId] || { count: 0, likedByUser: false };
            const newLikedByUser = !currentLikes.likedByUser;

            setLikes((prev) => ({
                ...prev,
                [participantId]: {
                    count: newLikedByUser ? currentLikes.count + 1 : currentLikes.count - 1,
                    likedByUser: newLikedByUser,
                },
            }));
            setIsLiking((prev) => ({ ...prev, [participantId]: true }));

            const performLike = async () => {
                try {
                    if (currentLikes.likedByUser) {
                        const likeDoc = await databases.listDocuments(DATABASE_ID, LIKES_ID, [
                            Query.equal('challengeId', id),
                            Query.equal('participantId', participantId),
                            Query.equal('userId', userId),
                        ]);
                        if (likeDoc.documents.length > 0) {
                            await databases.deleteDocument(DATABASE_ID, LIKES_ID, likeDoc.documents[0].$id);
                        }
                    } else {
                        const currentUserDoc = await databases.getDocument(DATABASE_ID, USERS_ID, userId);
                        await Promise.all([
                            databases.createDocument(DATABASE_ID, LIKES_ID, ID.unique(), {
                                challengeId: id,
                                participantId,
                                userId,
                                createdAt: new Date().toISOString(),
                            }),
                            databases.createDocument(DATABASE_ID, NOTIFICATIONS_ID, ID.unique(), {
                                userId: participantUserId,
                                message: `${currentUserDoc.displayName} đã thả tim video của bạn trong thử thách "${challenge.nameChallenge}".`,
                                challengeId: id,
                                createdAt: new Date().toISOString(),
                            }),
                        ]);
                    }
                } catch (error) {
                    console.error('Lỗi khi thả/bỏ tim:', error);
                    setLikes((prev) => ({ ...prev, [participantId]: currentLikes }));
                    alert('Không thể thực hiện thao tác. Vui lòng thử lại.');
                } finally {
                    setIsLiking((prev) => ({ ...prev, [participantId]: false }));
                }
            };

            performLike();
        },
        [userId, likes, id, challenge, isLiking],
    );

    const handleComment = useCallback(
        async (participantId, participantUserId, participantUserName, commentText) => {
            try {
                const currentUserDoc = await databases.getDocument(DATABASE_ID, USERS_ID, userId);
                await databases.createDocument(DATABASE_ID, NOTIFICATIONS_ID, ID.unique(), {
                    userId: participantUserId,
                    message: `${currentUserDoc.displayName} đã bình luận trên video của bạn trong thử thách "${challenge.nameChallenge}": "${commentText}"`,
                    challengeId: id,
                    createdAt: new Date().toISOString(),
                });
            } catch (error) {
                console.error('Lỗi khi gửi thông báo bình luận:', error);
                alert('Không thể gửi thông báo bình luận. Vui lòng thử lại.');
            }
        },
        [userId, challenge, id],
    );

    const participantList = useMemo(
        () =>
            participants.slice(0, visibleParticipants).map((p) => ({
                ...p,
                likes: likes[p.$id],
            })),
        [participants, visibleParticipants, likes],
    );

    const StarRating = useMemo(() => {
        return ({ currentRating, onRate }) => {
            const stars = [1, 2, 3, 4, 5];
            return (
                <div className="flex gap-1">
                    {isRatingLoading ? (
                        <div className="flex items-center">
                            <div className="w-5 h-5 border-2 border-t-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mr-2" />
                            <span className="text-gray-500">Đang xử lý...</span>
                        </div>
                    ) : (
                        stars.map((star) => (
                            <FontAwesomeIcon
                                key={star}
                                icon={star <= currentRating ? solidStar : regularStar}
                                className={`cursor-pointer ${
                                    star <= currentRating ? 'text-yellow-400' : 'text-gray-300'
                                } ${!hasJoined || isRatingLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                                onClick={hasJoined && !isRatingLoading ? () => onRate(star) : null}
                            />
                        ))
                    )}
                </div>
            );
        };
    }, [hasJoined, isRatingLoading]);

    if (loading) {
        return (
            <div className="container mx-auto p-6 bg-white rounded-lg shadow mt-8 mb-32">
                <Skeleton width={400} height={38} className="ml-[420px] mb-[28px] mt-[58px]" />
                <Skeleton className={cx('skeletonImage')} />
                <div className="mt-11 mb-11">
                    <Skeleton width={236} height={25} />
                    {Array(4)
                        .fill()
                        .map((_, i) => (
                            <Skeleton key={i} width={Math.random() * 150 + 150} height={15} />
                        ))}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow mt-8 mb-32">
            <div className="flex justify-end">
                <button
                    onClick={() => navigate(-1)}
                    className="text-5xl bg-slate-100 rounded-full p-2 hover:bg-slate-200 transition-colors"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div>
                <h1 className="text-6xl font-bold text-center mb-11">
                    {challenge?.nameChallenge || `Thử thách ${id}`}
                </h1>
                <img
                    src={challenge?.imgChallenge}
                    alt={challenge?.nameChallenge || `Thử thách ${id}`}
                    className={cx('challengeImage')}
                    loading="lazy"
                />
                <div className="mt-11 mb-11">
                    <h2 className="text-4xl font-semibold">Thông tin thử thách:</h2>
                    <p className="mt-2 text-gray-600">
                        <span className="text-gray-900">- Lĩnh vực:</span> {challenge?.field || 'Chưa xác định'}
                    </p>
                    <p className="mt-2 text-gray-600">
                        <span className="text-gray-900">- Mô tả:</span> {challenge?.describe || 'Không có mô tả.'}
                    </p>
                    <p className="mt-2 text-gray-600">
                        <span className="text-gray-900">- Số người tham gia:</span> {challenge?.participants || 0}
                    </p>
                    <p className="mt-2 text-gray-600">
                        <span className="text-gray-900">- Tác giả:</span> {challenge?.createdBy || 'Chưa xác định'}
                    </p>
                    <div className="mt-4">
                        <p className="text-gray-900 font-semibold">Đánh giá thử thách:</p>
                        <StarRating currentRating={userRating} onRate={handleRating} />
                        <p className="mt-2 text-gray-600">
                            Điểm trung bình: {averageRating} sao (dựa trên {ratingCount} đánh giá)
                            {!hasJoined && <span className="text-red-500"> - Tham gia để đánh giá</span>}
                        </p>
                    </div>
                    {hasJoined ? (
                        <button
                            onClick={handleLeaveChallenge}
                            className={`mt-4 bg-red-500 text-white font-semibold py-2 px-4 rounded transition-colors ${
                                loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                            }`}
                            disabled={loading}
                        >
                            {loading ? 'Đang rời...' : 'Rời khỏi thử thách'}
                        </button>
                    ) : (
                        <Link to={`/joinChallenge/${id}`}>
                            <button className="mt-4 bg-blue-500 text-white font-semibold py-2 px-4 rounded hover:bg-blue-600 transition-colors">
                                Tham gia ngay
                            </button>
                        </Link>
                    )}
                </div>
            </div>
            <section className="mt-8">
                <h2 className="text-xl font-bold mb-4">Danh sách người tham gia</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {participantList.length > 0 ? (
                        <Suspense fallback={<Skeleton count={visibleParticipants} height={200} />}>
                            {participantList.map((participant) => (
                                <Participant
                                    key={participant.$id}
                                    participant={participant}
                                    userId={userId}
                                    onLike={handleLike}
                                    isLiking={isLiking[participant.$id] || false}
                                    onComment={handleComment}
                                />
                            ))}
                        </Suspense>
                    ) : (
                        <p>Chưa có ai tham gia thử thách này.</p>
                    )}
                </div>
                {visibleParticipants < participants.length ? (
                    <button
                        onClick={handleShowMoreParticipants}
                        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                    >
                        Xem thêm
                    </button>
                ) : (
                    visibleParticipants > 3 && (
                        <button
                            onClick={handleShowLessParticipants}
                            className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
                        >
                            Ẩn bớt
                        </button>
                    )
                )}
            </section>
        </div>
    );
}

export default React.memo(ChallengeDetail);
