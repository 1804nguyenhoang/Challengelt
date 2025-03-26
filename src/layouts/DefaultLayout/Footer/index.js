import classNames from 'classnames/bind';
import styles from './Footer.module.scss';
import Container from 'react-bootstrap/Container';
import { Link, useLocation } from 'react-router-dom';

const cx = classNames.bind(styles);

function Footer() {
    const location = useLocation();
    return (
        <div className={cx('nav-footer')}>
            <Container className={cx('container')}>
                <Link
                    className={cx('link', {
                        active: location.pathname === '/home',
                    })}
                    to="/home"
                >
                    Trang chủ
                </Link>
                <Link
                    className={cx('link-center', {
                        active: location.pathname === '/explore',
                    })}
                    to="/explore"
                >
                    Khám phá
                </Link>
                <Link
                    className={cx('link', {
                        active: location.pathname === '/createChallenge',
                    })}
                    to="/createChallenge"
                >
                    Tạo thử thách
                </Link>
            </Container>
        </div>
    );
}

export default Footer;
