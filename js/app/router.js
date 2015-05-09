define(['director'], function(director) {
    var author = function () {
        console.log('author');
    };
    var books = function () {
        console.log('books');
    };
    var viewBook = function (bookId) {
        console.log('view book');
    };

    var routes = {
        '/author': author,
        '/books': [books, function () {
            console.log('books override');
        }],
        '/books/view/:bookId': viewBook
    };

    var router = Router(routes);

    router.init();
});