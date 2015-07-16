class BlogContainer extends React.Component {
    function initializeRoute(){
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
    }

    render() {
        return (
            <div id="main">
                <section className="two">
                    <div className="container">
                        This is my blog detail page
                    </div>
                </section>
                <section className="two">
                    <div className="container">
                        This part will be used for comments
                    </div>
                </section>
            </div>
        );
    }

}