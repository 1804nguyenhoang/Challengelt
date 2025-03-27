'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
    CHALLENGES_ID,
    DATABASE_ID,
    databases,
    DEFAULT_IMG,
    JOINED_CHALLENGES_ID,
    Query,
    USERS_ID,
} from '~/appwrite/config';
import { Link } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faClock,
    faFilter,
    faFire,
    faFireFlameCurved,
    faFlag,
    faPenNib,
    faUsers,
    faBars,
} from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames/bind';
import styles from './Explore.module.scss';
import { Drawer, Button, useMediaQuery, useTheme } from '@mui/material';

const cx = classNames.bind(styles);

function Explore() {
    const [popularChallenges, setPopularChallenges] = useState([]);
    const [newestChallenges, setNewestChallenges] = useState([]);
    const [topUsers, setTopUsers] = useState([]);
    const [allChallenges, setAllChallenges] = useState([]);
    const [filteredChallenges, setFilteredChallenges] = useState([]);
    const [visibleChallenges, setVisibleChallenges] = useState(4);
    const [allVideos, setAllVideos] = useState([]);
    const [filteredVideos, setFilteredVideos] = useState([]);
    const [visibleVideos, setVisibleVideos] = useState(3);
    const [selectedField, setSelectedField] = useState('Tất cả');
    const [loading, setLoading] = useState(true);
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('lg'));
    const [drawerOpen, setDrawerOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [popularResponse, newestResponse, usersResponse, challengesResponse, videosResponse] =
                await Promise.all([
                    databases.listDocuments(DATABASE_ID, CHALLENGES_ID, [
                        Query.orderDesc('participants'),
                        Query.limit(3),
                    ]),
                    databases.listDocuments(DATABASE_ID, CHALLENGES_ID, [
                        Query.orderDesc('$createdAt'),
                        Query.limit(3),
                    ]),
                    databases.listDocuments(DATABASE_ID, USERS_ID),
                    databases.listDocuments(DATABASE_ID, CHALLENGES_ID),
                    databases.listDocuments(DATABASE_ID, JOINED_CHALLENGES_ID),
                ]);

            setPopularChallenges(popularResponse.documents);
            setNewestChallenges(newestResponse.documents);

            // 🔹 Tạo Map để truy xuất thử thách nhanh hơn
            const challengeMap = new Map(challengesResponse.documents.map((challenge) => [challenge.$id, challenge]));

            // 🔹 Đếm số lượng thử thách của từng người dùng
            const userChallengeCount = usersResponse.documents.reduce((acc, user) => {
                acc[user.$id] = challengesResponse.documents.filter((c) => c.idUserCreated === user.$id).length;
                return acc;
            }, {});

            // 🔹 Sắp xếp tài khoản theo số thử thách đã tạo
            const sortedUsers = usersResponse.documents
                .map((user) => ({
                    ...user,
                    challengeCount: userChallengeCount[user.$id] || 0,
                }))
                .sort((a, b) => b.challengeCount - a.challengeCount)
                .slice(0, 3);

            setTopUsers(sortedUsers);
            setAllChallenges(challengesResponse.documents);
            setFilteredChallenges(challengesResponse.documents);

            // 🔹 Gán thông tin thử thách vào video
            const videoList = videosResponse.documents.map((video) => {
                const challenge = challengeMap.get(video.challengeId);
                return {
                    ...video,
                    challengeName: challenge?.nameChallenge || 'Không xác định',
                    field: challenge?.field || 'Không xác định',
                    uploaderName: video.userName || 'Không xác định',
                };
            });

            setAllVideos(videoList);
            setFilteredVideos(videoList);
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFilter = useCallback(
        (field) => {
            setSelectedField(field);
            setVisibleChallenges(4);
            setVisibleVideos(3);

            if (field === 'Tất cả') {
                setFilteredChallenges(allChallenges);
                setFilteredVideos(allVideos);
            } else {
                const filteredChallenges = allChallenges.filter((c) => c.field === field);
                const filteredVideos = allVideos.filter((v) => v.field === field);
                setFilteredChallenges(filteredChallenges);
                setFilteredVideos(filteredVideos);
            }
        },
        [allChallenges, allVideos],
    );
    const toggleDrawer = (open) => (event) => {
        if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }
        setDrawerOpen(open);
    };

    const sidebarContent = (
        <aside className={cx('bg-white shadow-lg rounded-lg p-4', 'sidebar')}>
            <div className="mb-8">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faFire}></FontAwesomeIcon>{' '}
                    <span className={cx('title-sidebar')}>Thử thách phổ biến</span>
                </h3>
                <ul>
                    {loading ? (
                        <Skeleton className="pt-[9px] mb-[3px]" height={34} count={3} />
                    ) : popularChallenges.length > 0 ? (
                        popularChallenges.map((challenge) => (
                            <Link to={`/challenge/${challenge.$id}`} key={challenge.$id}>
                                <li
                                    className={cx(
                                        'py-2 px-3 hover:bg-gray-200 cursor-pointer rounded-lg text-[#f86666] border-top',
                                        'item-sidebar',
                                    )}
                                >
                                    {challenge.nameChallenge}
                                </li>
                            </Link>
                        ))
                    ) : (
                        <p>Không có thử thách phổ biến</p>
                    )}
                </ul>
            </div>
            <div className="mb-8">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <FontAwesomeIcon className={cx('title-sidebar')} icon={faClock}></FontAwesomeIcon>{' '}
                    <span className={cx('title-sidebar')}>Thử thách mới nhất</span>
                </h3>
                <ul>
                    {loading ? (
                        <Skeleton className="pt-[9px] mb-[3px]" height={34} count={3} />
                    ) : newestChallenges.length > 0 ? (
                        newestChallenges.map((challenge) => (
                            <Link to={`/challenge/${challenge.$id}`} key={challenge.$id}>
                                <li
                                    className={cx(
                                        'py-2 px-3 hover:bg-gray-200 cursor-pointer rounded-lg text-[#f86666] border-top',
                                        'item-sidebar',
                                    )}
                                >
                                    {challenge.nameChallenge}
                                </li>
                            </Link>
                        ))
                    ) : (
                        <p>Không có thử thách nào mới</p>
                    )}
                </ul>
            </div>
            <div className="mb-6">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <FontAwesomeIcon className={cx('title-sidebar')} icon={faFireFlameCurved}></FontAwesomeIcon>{' '}
                    <span className={cx('title-sidebar')}>Tài khoản nổi bật</span>
                </h3>
                <ul className="mt-2">
                    {loading ? (
                        <Skeleton className="pt-[9px] mb-[3px]" height={34} count={3} />
                    ) : topUsers.length > 0 ? (
                        topUsers.map((user) => (
                            <Link to={`/profile/${user.$id}`} key={user.$id}>
                                <li className="py-2 px-3 flex hover:bg-gray-200 cursor-pointer rounded-lg text-[#f86666] border-top">
                                    <img
                                        src={user.imgUser || DEFAULT_IMG}
                                        alt="Avatar"
                                        className="w-12 h-12 mr-[4px] rounded-full object-cover"
                                    />
                                    <p className={cx('mt-[3px]', 'item-sidebar')}>{user.displayName}</p>
                                </li>
                            </Link>
                        ))
                    ) : (
                        <p>Không có tài khoản nổi bật</p>
                    )}
                </ul>
            </div>
        </aside>
    );

    return (
        <div>
            {isSmallScreen ? <h1 className={cx('font-bold text-3xl text-center mt-4')}>Khám phá</h1> : <></>}
            <div className="container relative mb-32 mt-4 bg-gray-50 min-h-screen">
                <div className="flex">
                    {isSmallScreen ? (
                        <>
                            <Button
                                sx={{
                                    position: 'absolute',
                                    top: '5px',
                                    left: '21px',
                                    zIndex: 1200,
                                    backgroundColor: '#f86666',
                                    color: 'white',
                                    '&:hover': { backgroundColor: '#e05555' },
                                }}
                                onClick={toggleDrawer(true)}
                            >
                                <FontAwesomeIcon icon={faBars} />
                            </Button>
                            <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
                                {sidebarContent}
                            </Drawer>
                        </>
                    ) : (
                        sidebarContent
                    )}
                    {/* Main Content */}
                    <main className="p-4 w-full">
                        {/* Bộ lọc lĩnh vực */}
                        <div className="w-full relative mb-4 flex justify-between items-center pb-3">
                            {isSmallScreen ? <></> : <h3 className={cx('font-bold', 'explore')}>Khám phá</h3>}

                            <div className="absolute right-0">
                                <FontAwesomeIcon icon={faFilter} className="absolute left-2 top-3 text-gray-500" />
                                <select
                                    className="pl-8 pr-4 py-2 border rounded-lg bg-white shadow"
                                    value={selectedField}
                                    onChange={(e) => {
                                        setSelectedField(e.target.value);
                                    }}
                                    onClick={() => handleFilter(selectedField)}
                                >
                                    {[
                                        'Tất cả',
                                        'Thể thao',
                                        'Đời sống',
                                        'Học tập',
                                        'Nấu ăn',
                                        'Sáng tạo',
                                        'Nghệ thuật',
                                        'Kinh doanh',
                                        'Khoa học',
                                        'Văn hóa',
                                    ].map((field) => (
                                        <option key={field} value={field}>
                                            {field}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Danh sách thử thách */}
                        <div className="bg-white p-4 shadow-lg rounded-lg mb-6">
                            <h3 className="text-4xl font-bold mb-4">Thử thách</h3>
                            {loading ? (
                                <Skeleton className="pt-[9px] mb-[3px]" height={39} count={5} />
                            ) : filteredChallenges.length > 0 ? (
                                <>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {filteredChallenges.slice(0, visibleChallenges).map((challenge) => (
                                            <Link to={`/challenge/${challenge.$id}`} key={challenge.$id}>
                                                <li className="border rounded-lg p-4 hover:shadow-lg transition-shadow duration-200">
                                                    <div className={cx('challenge-mobi')}>
                                                        <img
                                                            src={challenge.imgChallenge || DEFAULT_IMG}
                                                            alt="Avatar"
                                                            className="w-[198px] h-[100px] mb-2 object-cover"
                                                        />
                                                        <div className={cx('challenge-info')}>
                                                            <p className="text-3xl font-bold">
                                                                {challenge.nameChallenge}{' '}
                                                            </p>
                                                            <p className="text-xl text-gray-500">
                                                                <FontAwesomeIcon icon={faFlag}></FontAwesomeIcon> Lĩnh
                                                                vực: {challenge.field}
                                                            </p>
                                                            <p className="text-xl text-gray-500">
                                                                <FontAwesomeIcon icon={faPenNib}></FontAwesomeIcon> Tác
                                                                giả: {challenge.createdBy}
                                                            </p>
                                                            <p className="text-xl text-gray-500">
                                                                <FontAwesomeIcon icon={faUsers}></FontAwesomeIcon> Người
                                                                tham gia: {challenge.participants}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </li>
                                            </Link>
                                        ))}
                                    </ul>
                                    <div className="flex space-x-2 mt-2">
                                        {visibleChallenges < filteredChallenges.length && (
                                            <button
                                                className="bg-[#f86666] text-white px-3 py-1 rounded"
                                                onClick={() => setVisibleChallenges(visibleChallenges + 4)}
                                            >
                                                Xem thêm
                                            </button>
                                        )}
                                        {visibleChallenges > 4 && (
                                            <button
                                                className="bg-gray-300 px-3 py-1 rounded"
                                                onClick={() => setVisibleChallenges(4)}
                                            >
                                                Ẩn bớt
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p>Không có thử thách phù hợp</p>
                            )}
                        </div>

                        {/* Danh sách Video */}
                        <div className="bg-white p-4 shadow-lg rounded-lg">
                            <h3 className="text-4xl font-bold mb-4">Video</h3>
                            {loading ? (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-2 border rounded-lg shadow-md">
                                        <Skeleton width={190} height={24} className="ml-[50px]"></Skeleton>
                                        <Skeleton
                                            className="ml-[20px] rounded-lg mb-2"
                                            width={250}
                                            height={141}
                                        ></Skeleton>
                                        <Skeleton className="ml-[20px]" width={250}></Skeleton>
                                        <Skeleton className="ml-[20px]" width={250}></Skeleton>
                                        <Skeleton className="ml-[20px]" width={250}></Skeleton>
                                    </div>
                                    <div className="p-2 border rounded-lg shadow-md">
                                        <Skeleton width={190} height={24} className="ml-[50px]"></Skeleton>
                                        <Skeleton
                                            className="ml-[20px] rounded-lg mb-2"
                                            width={250}
                                            height={141}
                                        ></Skeleton>
                                        <Skeleton className="ml-[20px]" width={250}></Skeleton>
                                        <Skeleton className="ml-[20px]" width={250}></Skeleton>
                                        <Skeleton className="ml-[20px]" width={250}></Skeleton>
                                    </div>
                                    <div className="p-2 border rounded-lg shadow-md">
                                        <Skeleton width={190} height={24} className="ml-[50px]"></Skeleton>
                                        <Skeleton
                                            className="ml-[20px] rounded-lg mb-2"
                                            width={250}
                                            height={141}
                                        ></Skeleton>
                                        <Skeleton className="ml-[20px]" width={250}></Skeleton>
                                        <Skeleton className="ml-[20px]" width={250}></Skeleton>
                                        <Skeleton className="ml-[20px]" width={250}></Skeleton>
                                    </div>
                                </div>
                            ) : filteredVideos.length > 0 ? (
                                <>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        {filteredVideos.slice(0, visibleVideos).map((video) => (
                                            <Link to={`/challenge/${video.challengeId}`} key={video.$id}>
                                                <div className="p-2 border rounded-lg shadow-md">
                                                    <p className="font-bold text-center">
                                                        Người đăng: {video.uploaderName}
                                                    </p>
                                                    <div className={cx('video-mobi')}>
                                                        <video
                                                            src={video.videoURL}
                                                            controls
                                                            className={cx('rounded-lg mb-2 mx-auto', 'video')}
                                                            loading="lazy"
                                                        ></video>
                                                        <div className={cx('video-info')}>
                                                            <p className={cx('text-gray-900', 'tt')}>
                                                                Thử thách: {video.challengeName}
                                                            </p>
                                                            <p className={cx('text-gray-700', 'tt')}>
                                                                <FontAwesomeIcon icon={faFlag} /> Lĩnh vực:{' '}
                                                                {video.field}
                                                            </p>
                                                            <p className={cx('text-gray-700', 'tt')}>
                                                                <FontAwesomeIcon icon={faPenNib} /> Mô tả:{' '}
                                                                {video.describe}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                    <div className="flex space-x-2 mt-2">
                                        {visibleVideos < filteredVideos.length && (
                                            <button
                                                className="bg-[#f86666] px-3 py-1 rounded text-white"
                                                onClick={() => setVisibleVideos(visibleVideos + 3)}
                                            >
                                                Xem thêm
                                            </button>
                                        )}
                                        {visibleVideos > 3 && (
                                            <button
                                                className="bg-gray-300 px-3 py-1 rounded"
                                                onClick={() => setVisibleVideos(3)}
                                            >
                                                Ẩn bớt
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p>Không có video phù hợp</p>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}

export default Explore;
