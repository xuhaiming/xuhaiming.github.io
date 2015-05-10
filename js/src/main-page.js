define(['react', 'jquery', 'skel', 'skelLayers','director', 'init', 'sideBar', 'content'], function(React, $, myskel, skelLayers, director, init, SideBar, Content) {
        var initializeRoute = function(){
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

        var MainPage = React.createClass({
            componentWillMount: function(){
                initializeRoute();
            },
            render: function(){
                return (
                <div id="wrapper">
                    <Content></Content>
                    <SideBar></SideBar>
                </div>
                )
            }
        });

        React.render(
        <MainPage></MainPage>,
            document.getElementById('main-page')
        );
    }
);