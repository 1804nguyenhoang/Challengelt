'use client';
import classNames from 'classnames/bind';
import styles from './Header.module.scss';
import Container from 'react-bootstrap/Container';
import Button from '~/components/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBell,
    faComments,
    faRankingStar,
    faScrewdriverWrench,
    faSpinner,
    faUserGroup,
    faXmark,
    faBars,
} from '@fortawesome/free-solid-svg-icons';
import { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Search from '../Search';
import { UserContext } from '~/contexts/UserContext';
import {
    account,
    databases,
    client,
    Query,
    DATABASE_ID,
    USERS_ID,
    MESSAGES_ID,
    NOTIFICATIONS_ID,
    DEFAULT_IMG,
} from '~/appwrite/config';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

const cx = classNames.bind(styles);

function Header() {
    const location = useLocation();
    const { setUserId, setDisplayName, unreadCount, setUnreadCount } = useContext(UserContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [loginError, setLoginError] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [notiCount, setNotiCount] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const [userAvatar, setUserAvatar] = useState(DEFAULT_IMG);

    // Fetch current user
    useEffect(() => {
        let mounted = true;

        const fetchCurrentUser = async () => {
            try {
                const user = await account.get();
                if (mounted) {
                    setCurrentUser(user);
                    setUserId(user.$id);
                    setDisplayName(user.name);
                    setIsAdmin(user.labels?.includes('admin') || false);
                    const userDoc = await databases.getDocument(DATABASE_ID, USERS_ID, user.$id);
                    setUserAvatar(userDoc.imgUser || DEFAULT_IMG);
                }
            } catch {
                if (mounted) {
                    setCurrentUser(null);
                    setIsAdmin(false);
                }
            }
        };

        fetchCurrentUser();
        return () => {
            mounted = false;
        };
    }, [setUserId, setDisplayName]);

    // Handle login
    const handleLogin = useCallback(
        async (e) => {
            e.preventDefault();
            setLoginError('');
            setIsLoading(true);

            try {
                const email = e.target.email.value;
                const password = e.target.password.value;
                await account.createEmailPasswordSession(email, password);
                const user = await account.get();
                setCurrentUser(user);
                setUserId(user.$id);
                setDisplayName(user.name);
                const userDoc = await databases.getDocument(DATABASE_ID, USERS_ID, user.$id);
                setUserAvatar(userDoc.imgUser || DEFAULT_IMG);
                setIsModalOpen(false);
            } catch (error) {
                setLoginError('Đăng nhập thất bại: ' + error.message);
            } finally {
                setIsLoading(false);
            }
        },
        [setUserId, setDisplayName]
    );

    // Handle register
    const handleRegister = useCallback(async (e) => {
        e.preventDefault();
        setLoginError('');
        setIsLoading(true);

        const email = e.target.email.value;
        const password = e.target.password.value;
        const confirmPassword = e.target.confirmPassword.value;
        const name = e.target.name.value;

        if (password !== confirmPassword) {
            setLoginError('Mật khẩu xác nhận không khớp.');
            setIsLoading(false);
            return;
        }

        try {
            const user = await account.create('unique()', email, password, name);
            await databases.createDocument(DATABASE_ID, USERS_ID, user.$id, {
                displayName: name,
                gmail: email,
            });
            alert('Đăng ký thành công! Vui lòng đăng nhập.');
            setIsRegister(false);
        } catch (error) {
            setLoginError('Đăng ký thất bại: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch unread messages count
    const fetchUnreadCount = useCallback(async (userId) => {
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
            console.error('Lỗi khi lấy số tin nhắn chưa đọc:', error);
            return 0;
        }
    }, [setUnreadCount]);

    // Handle messages subscription
    useEffect(() => {
        if (!currentUser) return;

        fetchUnreadCount(currentUser.$id);
        const savedMessCount = localStorage.getItem(`messCount_${currentUser.$id}`);
        if (savedMessCount) setUnreadCount(parseInt(savedMessCount, 10));

        const unsubscribe = client.subscribe(
            `databases.${DATABASE_ID}.collections.${MESSAGES_ID}.documents`,
            (response) => {
                const payload = response.payload;
                if (payload?.receiverId === currentUser.$id && !payload.isRead) {
                    setUnreadCount((prev) => {
                        const newCount = prev + 1;
                        localStorage.setItem(`messCount_${currentUser.$id}`, newCount);
                        return newCount;
                    });
                }
            }
        );

        return () => unsubscribe();
    }, [currentUser, fetchUnreadCount, setUnreadCount]);

    // Fetch notifications count
    const fetchNotiCount = useCallback(async (userId) => {
        try {
            const response = await databases.listDocuments(DATABASE_ID, NOTIFICATIONS_ID, [
                Query.equal('userId', userId),
                Query.equal('isRead', false),
            ]);
            setNotiCount(response.documents.length);
        } catch (error) {
            console.error('Lỗi khi lấy số thông báo chưa đọc:', error);
        }
    }, []);

    // Handle notifications subscription
    useEffect(() => {
        if (!currentUser) return;

        fetchNotiCount(currentUser.$id);

        const unsubscribe = client.subscribe(
            `databases.${DATABASE_ID}.collections.${NOTIFICATIONS_ID}.documents`,
            (response) => {
                const newNotification = response.payload;
                if (newNotification?.userId === currentUser.$id) {
                    setNotiCount((prev) => prev + 1);
                }
            }
        );

        return () => unsubscribe();
    }, [currentUser, fetchNotiCount]);

    // Mark notifications as read
    useEffect(() => {
        if (!currentUser || location.pathname !== '/notification') return;

        const markNotificationsAsRead = async () => {
            try {
                const response = await databases.listDocuments(DATABASE_ID, NOTIFICATIONS_ID, [
                    Query.equal('userId', currentUser.$id),
                    Query.equal('isRead', false),
                ]);
                const unreadNotifications = response.documents;

                await Promise.all(
                    unreadNotifications.map((notification) =>
                        databases.updateDocument(DATABASE_ID, NOTIFICATIONS_ID, notification.$id, {
                            isRead: true,
                        })
                    )
                );
                setNotiCount(0);
                localStorage.setItem(`notiCount_${currentUser.$id}`, '0');
            } catch (error) {
                console.error('Lỗi khi đánh dấu thông báo đã đọc:', error);
            }
        };

        markNotificationsAsRead();
    }, [currentUser, location.pathname]);

    // Handle click outside menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                isMenuOpen &&
                menuRef.current &&
                !menuRef.current.contains(event.target) &&
                !event.target.closest(`.${cx('menu-toggle')}`)
            ) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    // Close menu on path change or login modal open
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname, isModalOpen]);

    const handleMenuItemClick = () => setIsMenuOpen(false);

    // Handle login button click (for both desktop and mobile)
    const handleLoginClick = () => {
        setIsModalOpen(true);
        setIsMenuOpen(false); // Đóng menu khi mở modal ở mobile
    };

    const ModalForm = () => (
        <div className={cx('modal-overlay', { show: isModalOpen })}>
            <div className={cx('modal-form', { show: isModalOpen })}>
                <h1>{isRegister ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập vào Challengelt'}</h1>
                {!isLoading && (
                    <FontAwesomeIcon
                        className={cx('close-modal')}
                        onClick={() => setIsModalOpen(false)}
                        icon={faXmark}
                    />
                )}
                <form onSubmit={isRegister ? handleRegister : handleLogin}>
                    {isRegister && (
                        <input name="name" type="text" placeholder="Tên hiển thị" required disabled={isLoading} />
                    )}
                    <input name="email" type="email" placeholder="Email" required disabled={isLoading} />
                    <input name="password" type="password" placeholder="Mật khẩu" required disabled={isLoading} />
                    {isRegister && (
                        <input
                            name="confirmPassword"
                            type="password"
                            placeholder="Xác nhận mật khẩu"
                            required
                            disabled={isLoading}
                        />
                    )}
                    {loginError && <p className={cx('error')}>{loginError}</p>}
                    <button className={cx('btn-login')} type="submit" disabled={isLoading}>
                        {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : isRegister ? 'Đăng Ký' : 'Đăng Nhập'}
                    </button>
                    {!isLoading && (
                        <div className={cx('form-footer')}>
                            <p className='text-center'>Hoặc</p>
                            <span>
                                {isRegister ? (
                                    <>
                                        Bạn đã có tài khoản?{' '}
                                        <span className={cx('btn-dangnhap')} onClick={() => setIsRegister(false)}>
                                            Đăng Nhập
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        Bạn chưa có tài khoản?{' '}
                                        <span className={cx('btn-dangky')} onClick={() => setIsRegister(true)}>
                                            Đăng Ký
                                        </span>
                                    </>
                                )}
                            </span>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );

    return (
        <div className={cx('nav-header')}>
            <Container className={cx('con-nav')}>
                <Link to="/home">
                    <img className={cx('logo')} src="/logoweb.png" height={50} width={70} alt="Challengelt" />
                </Link>
                <Search />
                <div className={cx('action')}>
                    {currentUser ? (
                        <>
                            {isAdmin && (
                                <Tippy content="Admin" placement="bottom">
                                    <Link
                                        className={cx('iconAdmin', { active: location.pathname === '/admin' })}
                                        to="/admin"
                                    >
                                        <FontAwesomeIcon icon={faScrewdriverWrench} />
                                    </Link>
                                </Tippy>
                            )}
                            <Tippy content="Bạn bè" placement="bottom">
                                <Link
                                    className={cx('iconFriends', { active: location.pathname === '/friends' })}
                                    to="/friends"
                                >
                                    <FontAwesomeIcon icon={faUserGroup} />
                                </Link>
                            </Tippy>
                            <Tippy content="Nhắn tin" placement="bottom">
                                <Link
                                    className={cx('iconMess', { active: location.pathname === '/chat' })}
                                    to="/chat"
                                >
                                    <FontAwesomeIcon icon={faComments} />
                                    {unreadCount > 0 && (
                                        <span className={cx('new-noti')}>
                                            <span className="absolute right-[4px] text-white text-[10px]">
                                                {unreadCount}
                                            </span>
                                        </span>
                                    )}
                                </Link>
                            </Tippy>
                            <Tippy content="Thông báo" placement="bottom">
                                <Link
                                    className={cx('iconNotification', { active: location.pathname === '/notification' })}
                                    to="/notification"
                                >
                                    <FontAwesomeIcon icon={faBell} />
                                    {notiCount > 0 && (
                                        <span className={cx('unread-badge')}>
                                            <span className="absolute right-[4px] text-white text-[10px]">
                                                {notiCount}
                                            </span>
                                        </span>
                                    )}
                                </Link>
                            </Tippy>
                            <Tippy content="Trang cá nhân" placement="bottom">
                                <Link
                                    className={cx('iconProfile', { active: location.pathname === '/profile' })}
                                    to="/profile"
                                >
                                    <img
                                        src={userAvatar}
                                        alt="User Avatar"
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                </Link>
                            </Tippy>
                        </>
                    ) : (
                        <Button className={cx('btn-login')} onClick={handleLoginClick} primary>
                            Đăng Nhập
                        </Button>
                    )}
                    <Tippy content="Bảng xếp hạng" placement="bottom">
                        <Link className={cx('iconRank', { active: location.pathname === '/rank' })} to="/rank">
                            <FontAwesomeIcon icon={faRankingStar} />
                        </Link>
                    </Tippy>
                    <button className={cx('menu-toggle')} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        <FontAwesomeIcon icon={faBars} />
                    </button>
                </div>
                {isMenuOpen && (
                    <div className={cx('mobile-menu')} ref={menuRef}>
                        {currentUser ? (
                            <>
                                {isAdmin && (
                                    <Link to="/admin" onClick={handleMenuItemClick}>
                                        <FontAwesomeIcon className={cx('action-mobi')} icon={faScrewdriverWrench} />{' '}
                                        Admin
                                    </Link>
                                )}
                                <Link to="/profile" onClick={handleMenuItemClick}>
                                    <img
                                        src={userAvatar}
                                        alt="User Avatar"
                                        className="w-11 h-11 rounded-full object-cover inline-block mr-2"
                                    />
                                    Trang cá nhân
                                </Link>
                                <Link to="/friends" onClick={handleMenuItemClick}>
                                    <FontAwesomeIcon className={cx('action-mobi')} icon={faUserGroup} /> Bạn bè
                                </Link>
                                <Link to="/chat" onClick={handleMenuItemClick}>
                                    <FontAwesomeIcon className={cx('action-mobi')} icon={faComments} /> Nhắn tin
                                    {unreadCount > 0 && (
                                        <span className={cx('new-noti-mobi')}>
                                            <span className="absolute right-[4px] text-white text-[10px]">
                                                {unreadCount}
                                            </span>
                                        </span>
                                    )}
                                </Link>
                                <Link to="/notification" onClick={handleMenuItemClick}>
                                    <FontAwesomeIcon className={cx('action-mobi')} icon={faBell} /> Thông báo
                                    {notiCount > 0 && (
                                        <span className={cx('unread-badge-mobi')}>
                                            <span className="absolute right-[4px] text-white text-[10px]">
                                                {notiCount}
                                            </span>
                                        </span>
                                    )}
                                </Link>
                                <Link to="/rank" onClick={handleMenuItemClick}>
                                    <FontAwesomeIcon className={cx('action-mobi')} icon={faRankingStar} /> Bảng xếp hạng
                                </Link>
                            </>
                        ) : (
                            <Button className={cx('btn-login')} onClick={handleLoginClick} primary>
                                Đăng Nhập
                            </Button>
                        )}
                    </div>
                )}
                {isModalOpen && <ModalForm />}
            </Container>
        </div>
    );
}

export default Header;