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

        var MainPage = React.createClass({displayName: "MainPage",
            componentWillMount: function(){
                initializeRoute();
            },
            render: function(){
                return (
                React.createElement("div", {id: "wrapper"}, 
                    React.createElement(Content, null), 
                    React.createElement(SideBar, null)
                )
                )
            }
        });

        React.render(
        React.createElement(MainPage, null),
            document.getElementById('main-page')
        );
    }
);