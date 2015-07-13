requirejs.config({
    baseUrl: 'assets/js/lib',
    paths: {
        app: '../app',
        react: 'react.min',
        underscore: 'underscore.min',
        jquery: 'jquery.min',
        director: 'director.min',
        skel: 'skel.min',
        scrolly: 'jquery.scrolly.min',
        scrollzer: 'jquery.scrollzer.min'
    },
    shim: {
        underscore: {
            exports: '_'
        }
    }
});

