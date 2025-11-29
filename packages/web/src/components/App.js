'use client';
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.App = App;
var LayoutContext_1 = require('@/components/context/LayoutContext');
var Home_1 = require('@/components/pages/Home');
var react_cookie_1 = require('react-cookie');
require('./App.css');
function Root() {
  return <Home_1.default />;
}
function App() {
  return (
    <react_cookie_1.CookiesProvider>
      <LayoutContext_1.LayoutProvider>
        <Root />
      </LayoutContext_1.LayoutProvider>
    </react_cookie_1.CookiesProvider>
  );
}
exports.default = App;
