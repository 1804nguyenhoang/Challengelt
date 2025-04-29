import classNames from 'classnames/bind';
import styles from './Home.module.scss';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CHALLENGES_ID, DATABASE_ID, databases, DEFAULT_IMG, Query, RATINGS_ID } from '~/appwrite/config';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFlag, faPenNib, faUsers, faStar as solidStar } from '@fortawesome/free-solid-svg-icons';
import { faStar as regularStar } from '@fortawesome/free-regular-svg-icons';

const cx = classNames.bind(styles);

function Home() {
    const navigate = useNavigate();
    const location = useLocation();
    const [challenges, setChallenges] = useState([]);
    const [currentPage, setCurrentPage] = useState(() => {
        const params = new URLSearchParams(location.search);
        return parseInt(params.get('page'), 10) || 1;
    });
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const limit = 6;

    const fetchChallenges = useCallback(async (page) => {
        setLoading(true);
        try {
            const offset = (page - 1) * limit;
            const response = await databases.listDocuments(DATABASE_ID, CHALLENGES_ID, [
                Query.limit(limit),
                Query.offset(offset),
                Query.orderDesc('participants'), // Sort by participants (descending)
            ]);

            const challengeIds = response.documents.map((challenge) => challenge.$id);
            const ratingsPromises = challengeIds.map((id) =>
                databases.listDocuments(DATABASE_ID, RATINGS_ID, [Query.equal('challengeId', id)]),
            );

            const ratingsResponses = await Promise.all(ratingsPromises);
            let enrichedChallenges = response.documents.map((challenge, index) => {
                const ratings = ratingsResponses[index].documents;
                const averageRating =
                    ratings.length > 0
                        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
                        : 0;
                return { ...challenge, averageRating: parseFloat(averageRating) };
            });

            // Sort by averageRating as a secondary criterion (in-memory)
            enrichedChallenges = enrichedChallenges.sort((a, b) => {
                if (a.participants === b.participants) {
                    return b.averageRating - a.averageRating; // Sort by averageRating descending
                }
                return b.participants - a.participants; // Primary sort by participants descending
            });

            setChallenges(enrichedChallenges);
            setTotalPages(Math.ceil(response.total / limit));
        } catch (error) {
            console.error('Error fetching challenges:', error);
            alert('Không thể tải danh sách thử thách. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const pageFromUrl = parseInt(params.get('page'), 10) || 1;
        if (pageFromUrl !== currentPage) {
            setCurrentPage(pageFromUrl);
        }
    }, [location.search, currentPage]);

    useEffect(() => {
        fetchChallenges(currentPage);
    }, [currentPage, fetchChallenges]);

    const handlePageChange = useCallback(
        (page) => {
            if (page >= 1 && page <= totalPages && page !== currentPage) {
                setLoading(true);
                setCurrentPage(page);
                navigate(`/home?page=${page}`);
            }
        },
        [currentPage, totalPages, navigate],
    );

    const StarDisplay = useCallback(({ rating }) => {
        const stars = [1, 2, 3, 4, 5];
        return (
            <div className="flex items-center">
                {stars.map((star) => (
                    <FontAwesomeIcon
                        key={star}
                        icon={star <= rating ? solidStar : regularStar}
                        className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
                        size="sm"
                    />
                ))}
                <span className="ml-1 text-gray-500">({rating})</span>
            </div>
        );
    }, []);

    return (
        <div className="container mb-32">
            <section className={cx('mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6')}>
                {loading
                    ? Array.from({ length: limit }).map((_, index) => (
                          <div key={index} className="bg-white p-4 rounded-lg shadow-lg">
                              <Skeleton className={cx('rounded-lg mb-4 object-cover', 'skeleton-image')} height={200} />
                              <Skeleton className={cx('skeleton-text')} />
                              <Skeleton width="80%" className={cx('skeleton-text')} />
                              <Skeleton width="50%" className={cx('skeleton-text')} />
                          </div>
                      ))
                    : challenges.map((challenge) => (
                          <Link
                              to={`/challenge/${challenge.$id}`}
                              key={challenge.$id}
                              className={cx(
                                  'bg-white rounded-lg shadow transition-transform transform hover:scale-105',
                                  'challenge-card',
                              )}
                          >
                              <div className={cx('itemMobile')}>
                                  <img
                                      className={cx('challengeImage', 'rounded-lg mb-4 object-cover')}
                                      src={challenge.imgChallenge || DEFAULT_IMG}
                                      alt={challenge.nameChallenge || `Thử thách ${challenge.$id}`}
                                      loading="lazy"
                                  />
                                  <div className={cx('truncate')}>
                                      <h3 className={cx('challenge-title', 'font-bold mb-3 truncate')}>
                                          {challenge.nameChallenge || `Thử thách ${challenge.$id}`}
                                      </h3>
                                      <p className={cx('challenge-info', 'mb-[3px] text-gray-500')}>
                                          <FontAwesomeIcon icon={faFlag} /> Lĩnh vực:{' '}
                                          {challenge.field || 'Chưa xác định'}
                                      </p>
                                      <p className={cx('challenge-info', 'mb-[3px] text-gray-500')}>
                                          <FontAwesomeIcon icon={faUsers} /> Số người tham gia:{' '}
                                          {challenge.participants || 0}
                                      </p>
                                      <p className={cx('challenge-info', 'mb-[3px] text-gray-500')}>
                                          <FontAwesomeIcon icon={faPenNib} /> Tác giả:{' '}
                                          {challenge.createdBy || 'Không xác định'}
                                      </p>
                                      <p className={cx('challenge-info', 'mb-[3px] text-gray-500')}>
                                          <StarDisplay rating={challenge.averageRating} />
                                      </p>
                                  </div>
                              </div>
                          </Link>
                      ))}
            </section>

            <div className={cx('mt-6 space-x-2', 'pagination')}>
                <button
                    className={`px-2 py-2 rounded-md bg-gray-200 ${
                        currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                    }`}
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(1)}
                >
                    Đầu
                </button>
                <button
                    className={`px-2 py-2 rounded-md bg-gray-200 ${
                        currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                    }`}
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                >
                    Trước
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                        key={page}
                        className={`px-3 py-2 rounded-md ${
                            page === currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                        onClick={() => handlePageChange(page)}
                    >
                        {page}
                    </button>
                ))}
                <button
                    className={`px-2 py-2 rounded-md bg-gray-200 ${
                        currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                    }`}
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                >
                    Sau
                </button>
                <button
                    className={`px-2 py-2 rounded-md bg-gray-200 ${
                        currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
                    }`}
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(totalPages)}
                >
                    Cuối
                </button>
            </div>
        </div>
    );
}

export default React.memo(Home);
