import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { publicRoutes } from '~/routes';
import { DefaultLayout } from './layouts';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useState } from 'react';
function App() {
    const [currentUser, setCurrentUser] = useState(null);
    return (
        <Router>
            <div className="App">
                <Routes>
                    {publicRoutes.map((route, index) => {
                        const Layout = route.layout || DefaultLayout;
                        const Page = route.component;
                        if (route.path === '/profile') {
                            return (
                                <Route
                                    key={index}
                                    path={route.path}
                                    element={
                                        <Layout>
                                            <Page user={currentUser} />
                                        </Layout>
                                    }
                                />
                            );
                        } else
                            return (
                                <Route
                                    key={index}
                                    path={route.path}
                                    element={
                                        <Layout>
                                            <Page />
                                        </Layout>
                                    }
                                />
                            );
                    })}
                </Routes>
            </div>
        </Router>
    );
}

export default App;
