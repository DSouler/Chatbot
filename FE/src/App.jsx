import { HashRouter, Route, Routes } from "react-router-dom";
import { Provider } from 'react-redux';
import { store } from './store';
import AuthInitializer from './components/AuthInitializer';
import "./App.css";
import routes from "./routers";

function App() {
  return (
    <>
      <Provider store={store}>
        <AuthInitializer>
          <HashRouter>
            <Routes>
            {routes.map((route, index) => {
              return (
                <Route key={index} path={route.path} name={route.name} element={route.element}>
                  {route?.children && route.children.length > 0 ?
                    route.children.map((routeChild, idx) => {
                      return (
                        <Route key={idx} name={routeChild.name} path={routeChild.path} element={routeChild.element}></Route>
                      )
                    })
                    :
                    <></>}
                </Route>
              );
            })}
            </Routes>
          </HashRouter>
        </AuthInitializer>
      </Provider>
    </>
  );
}

export default App;
