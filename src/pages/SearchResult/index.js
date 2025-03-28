import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CHALLENGES_ID, DATABASE_ID, databases, DEFAULT_IMG, JOINED_CHALLENGES_ID, Query, USERS_ID } from '~/appwrite/config';
import SearchItem from '~/components/SearchItem';
import AccountItem from '~/components/AccountItem';
import Skeleton from 'react-loading-skeleton';

function SearchResult() {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('query');
    const [activeTab, setActiveTab] = useState('challenge');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchResults = useCallback(
        async (type) => {
            if (!query) return;
            setLoading(true);

            try {
                let response;
                let formattedResults = [];

                switch (type) {
                    case 'challenge':
                        response = await databases.listDocuments(DATABASE_ID, CHALLENGES_ID, [
                            Query.contains('nameChallenge', query),
                        ]);
                        formattedResults = response.documents.map((doc) => ({
                            id: `challenge-${doc.$id}`,
                            type: 'challenge',
                            data: doc,
                        }));
                        break;

                    case 'account':
                        response = await databases.listDocuments(DATABASE_ID, USERS_ID, [
                            Query.contains('displayName', query),
                        ]);
                        formattedResults = response.documents.map((doc) => ({
                            id: `account-${doc.$id}`,
                            type: 'account',
                            data: doc,
                        }));
                        break;

                    case 'video':
                        response = await databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID, [
                            Query.contains('describe', query),
                        ]);

                        const challengeMap = new Map();
                        const userMap = new Map();

                        await Promise.all(
                            response.documents.map(async (video) => {
                                if (!challengeMap.has(video.challengeId)) {
                                    challengeMap.set(
                                        video.challengeId,
                                        databases.getDocument(DATABASE_ID, CHALLENGES_ID, video.challengeId),
                                    );
                                }
                                if (!userMap.has(video.idUserJoined)) {
                                    userMap.set(
                                        video.idUserJoined,
                                        databases.getDocument(DATABASE_ID, USERS_ID, video.idUserJoined),
                                    );
                                }
                            }),
                        );

                        const [challengeResults, userResults] = await Promise.all([
                            Promise.all([...challengeMap.values()]),
                            Promise.all([...userMap.values()]),
                        ]);

                        challengeResults.forEach((challenge) => challengeMap.set(challenge.$id, challenge));
                        userResults.forEach((user) => userMap.set(user.$id, user));

                        formattedResults = response.documents.map((video) => ({
                            id: `video-${video.$id}`,
                            type: 'video',
                            data: {
                                ...video,
                                challengeName: challengeMap.get(video.challengeId)?.nameChallenge || 'Không xác định',
                                userImg: userMap.get(video.idUserJoined)?.imgUser || '',
                            },
                        }));
                        break;

                    default:
                        console.warn('Loại tìm kiếm không hợp lệ:', type);
                        return;
                }

                setSearchResults(formattedResults);
            } catch (error) {
                console.error('Lỗi khi tìm kiếm:', error);
            } finally {
                setLoading(false);
            }
        },
        [query],
    );

    useEffect(() => {
        if (query) {
            fetchResults('challenge');
        }
    }, [query, fetchResults]);

    return (
        <div className="container mx-auto mt-8 mb-16 p-4 sm:p-6 bg-white rounded-lg shadow">
            <h1 className="text-2xl sm:text-3xl font-bold mb-6">Kết quả tìm kiếm cho: "{query}"</h1>

            {/* Menu Điều Hướng */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
                <button
                    className={`px-4 py-2 rounded font-semibold text-sm sm:text-base ${
                        activeTab === 'challenge' ? 'bg-[#f86666] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => {
                        setActiveTab('challenge');
                        fetchResults('challenge');
                    }}
                >
                    Thử thách
                </button>
                <button
                    className={`px-4 py-2 rounded font-semibold text-sm sm:text-base ${
                        activeTab === 'account' ? 'bg-[#f86666] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => {
                        setActiveTab('account');
                        fetchResults('account');
                    }}
                >
                    Người dùng
                </button>
                <button
                    className={`px-4 py-2 rounded font-semibold text-sm sm:text-base ${
                        activeTab === 'video' ? 'bg-[#f86666] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    onClick={() => {
                        setActiveTab('video');
                        fetchResults('video');
                    }}
                >
                    Video
                </button>
            </div>

            {/* Hiển thị kết quả theo tab đã chọn */}
            {activeTab === 'challenge' && (
                <div>
                    <h2 className="text-lg sm:text-xl font-semibold mb-4">Thử thách</h2>
                    {loading ? (
                        <Skeleton count={5} height={50} className="mb-2" />
                    ) : searchResults.length > 0 ? (
                        <div className="space-y-2">
                            {searchResults.map((result) => (
                                <SearchItem key={result.id} data={result.data} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm sm:text-base">Không có thử thách nào.</p>
                    )}
                </div>
            )}

            {activeTab === 'account' && (
                <div>
                    <h2 className="text-lg sm:text-xl font-semibold mb-4">Người dùng</h2>
                    {loading ? (
                        <Skeleton count={5} height={50} className="mb-2" />
                    ) : searchResults.length > 0 ? (
                        <div className="space-y-2">
                            {searchResults.map((result) => (
                                <AccountItem key={result.id} data={result.data} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm sm:text-base">Không có tài khoản nào.</p>
                    )}
                </div>
            )}

            {activeTab === 'video' && (
                <div>
                    <h2 className="text-lg sm:text-xl font-semibold mb-4">Video</h2>
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[...Array(3)].map((_, index) => (
                                <div key={index}>
                                    <Skeleton height={24} className="mb-2" />
                                    <Skeleton height={175} />
                                    <Skeleton height={13} className="mt-2 mb-3" />
                                    <div className="flex items-center gap-2">
                                        <Skeleton circle width={40} height={40} />
                                        <Skeleton width={100} height={20} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : searchResults.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {searchResults.map((result) => (
                                <div key={result.id} className="p-4 bg-gray-100 rounded-lg shadow">
                                    <Link to={`/challenge/${result.data.challengeId}`}>
                                        <p className="text-blue-600 font-semibold mb-2 text-sm sm:text-base">
                                            {result.data.challengeName || 'Không có dữ liệu'}
                                        </p>
                                    </Link>
                                    <video
                                        src={result.data.videoURL}
                                        controls
                                        className="w-full h-40 sm:h-48 rounded-lg object-cover"
                                        loading="lazy"
                                    />
                                    <p className="mt-2 text-sm sm:text-base text-gray-600">Mô tả: {result.data.describe}</p>
                                    <Link
                                        to={`/profile/${result.data.idUserJoined}`}
                                        className="flex items-center mt-2"
                                    >
                                        <img
                                            src={result.data.userImg || DEFAULT_IMG}
                                            alt="User Avatar"
                                            className="w-10 h-10 rounded-full object-cover"
                                            loading="lazy"
                                        />
                                        <p className="font-semibold ml-2 text-sm sm:text-base">{result.data.userName}</p>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm sm:text-base">Không có video nào.</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default SearchResult;