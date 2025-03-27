import { faCircleXmark, faMagnifyingGlass, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Tippy from '@tippyjs/react/headless';
import { Wrapper as PopperWrapper } from '~/components/Popper';
import AccountItem from '~/components/AccountItem';
import SearchItem from '~/components/SearchItem';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames/bind';
import styles from './Search.module.scss';
import React , { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useDebounce } from '~/hooks';
import { databases,Query,DATABASE_ID,USERS_ID,CHALLENGES_ID } from '~/appwrite/config';
import { useNavigate } from 'react-router-dom';

const cx = classNames.bind(styles);

function Search() {
    const [searchValue, setSearchValue] = useState('');
    const [searchResult, setSearchResult] = useState([]);
    const [showResult, setShowResult] = useState(true);
    const [loading, setLoading] = useState(false);
    const debounce = useDebounce(searchValue, 500);
    const inputRef = useRef();
    const navigate = useNavigate();


    const handleClear = useCallback(() => {
        setSearchValue('');
        setSearchResult([]);
        inputRef.current.focus();
    }, []);

    const handleHideResult = useCallback(() => {
        setShowResult(false);
    }, []);

    const handleSelectItem = useCallback(() => {
        setShowResult(false);
    }, []);

    useEffect(() => {
        const fetchSearchResults = async () => {
            if (!debounce.trim()) {
                setSearchResult([]);
                return;
            }

            setLoading(true);

            try {
                const [accountResponse, challengeResponse] = await Promise.all([
                    databases.listDocuments(DATABASE_ID, USERS_ID, [
                        Query.contains('displayName', debounce),
                        Query.limit(3),
                    ]),
                    databases.listDocuments(DATABASE_ID, CHALLENGES_ID, [
                        Query.contains('nameChallenge', debounce),
                        Query.limit(5),
                    ]),
                ]);

                setSearchResult([
                    ...accountResponse.documents.map((doc) => ({
                        id: `account-${doc.$id}`,
                        type: 'account',
                        data: doc,
                    })),
                    ...challengeResponse.documents.map((doc) => ({
                        id: `challenge-${doc.$id}`,
                        type: 'challenge',
                        data: doc,
                    })),
                ]);
            } catch (error) {
                console.error('Error fetching search results:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSearchResults();
    }, [debounce]);

    const handleSearchSubmit = useCallback(() => {
        if (searchValue.trim()) {
            navigate(`/search?query=${encodeURIComponent(searchValue)}`);
            setShowResult(false);
        }
    }, [searchValue, navigate]);

    const filteredChallengeResult = useMemo(() => searchResult.slice(0, 5), [searchResult]);
    const filteredAccountResult = useMemo(() => searchResult.slice(0, 3), [searchResult]);

    return (
        <Tippy
            placement="bottom"
            interactive
            visible={showResult && searchResult.length > 0}
            render={(attr) => (
                <div className={cx('search-result')} tabIndex="-1" {...attr}>
                    <PopperWrapper>
                        <h4 className={cx('search-title')}>Thử thách</h4>
                        {filteredChallengeResult
                            .filter((result) => result.type === 'challenge')
                            .map((result) => (
                                <div key={result.id} onClick={handleSelectItem}>
                                    <SearchItem data={result.data} />
                                </div>
                            ))}
                        <h4 className={cx('search-title')}>Tài khoản</h4>
                        {filteredAccountResult
                            .filter((result) => result.type === 'account')
                            .map((result) => (
                                <div key={result.id} onClick={handleSelectItem}>
                                    <AccountItem data={result.data} />
                                </div>
                            ))}
                    </PopperWrapper>
                </div>
            )}
            onClickOutside={handleHideResult}
        >
            <div className={cx('search')}>
                <input
                    ref={inputRef}
                    value={searchValue}
                    className={cx('input')}
                    size="lg"
                    type="text"
                    placeholder="Tìm kiếm thử thách"
                    spellCheck={false}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onFocus={() => setShowResult(true)}
                />
                {!!searchValue && !loading && (
                    <button onClick={handleClear}>
                        <FontAwesomeIcon className={cx('clear')} icon={faCircleXmark} />
                    </button>
                )}
                {loading && <FontAwesomeIcon icon={faSpinner} className={cx('loading')} />}
                <button onClick={handleSearchSubmit}>
                    <FontAwesomeIcon className={cx('search-btn')} icon={faMagnifyingGlass} />
                </button>
            </div>
        </Tippy>
    );
}

export default React.memo(Search);
