requirejs.config({
    baseUrl: 'js/lib',
    paths: {
        app: '../app',
        react: 'react.min',
        underscore: 'underscore.min',
        jquery: 'jquery.min',
        director: 'director.min',
        skel: 'skel.min',
        skelLayers: 'skel-layers.min',
        init: 'init',
        router: '../app/router',
        sideBar: '../app/side-bar',
        boxCalendar: '../app/box-calendar',
        content: '../app/content'
    },
    shim: {
        underscore: {
            exports: '_'
        }
    }
});

