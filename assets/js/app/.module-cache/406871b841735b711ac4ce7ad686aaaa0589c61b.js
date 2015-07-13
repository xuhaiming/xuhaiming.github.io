define(['react', 'jquery', 'skel','director'],
    function(React, $, myskel, director) {
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
        };

        var MainPage = React.createClass({displayName: "MainPage",
            componentWillMount: function(){
                initializeRoute();
            },
            render: function(){
                return (
                React.createElement("div", null, 
                    React.createElement("section", {id: "header"}, 
                        React.createElement("header", null, 
                            React.createElement("span", {class: "image avatar"}, React.createElement("img", {src: "images/avatar.jpg", alt: ""})), 
                            React.createElement("h1", {id: "logo"}, React.createElement("a", {href: "#"}, "Willis Corto")), 
                            React.createElement("p", null, "I got reprogrammed by a rogue AI", React.createElement("br", null), 
                                "and now I'm totally cray")
                        ), 
                        React.createElement("nav", {id: "nav"}, 
                            React.createElement("ul", null, 
                                React.createElement("li", null, React.createElement("a", {href: "#one", class: "active"}, "About")), 
                                React.createElement("li", null, React.createElement("a", {href: "#two"}, "Things I Can Do")), 
                                React.createElement("li", null, React.createElement("a", {href: "#three"}, "A Few Accomplishments")), 
                                React.createElement("li", null, React.createElement("a", {href: "#four"}, "Contact"))
                            )
                        ), 
                        React.createElement("footer", null, 
                            React.createElement("ul", {class: "icons"}, 
                                React.createElement("li", null, React.createElement("a", {href: "#", class: "icon fa-twitter"}, React.createElement("span", {class: "label"}, "Twitter"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#", class: "icon fa-facebook"}, React.createElement("span", {class: "label"}, "Facebook"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#", class: "icon fa-instagram"}, React.createElement("span", {class: "label"}, "Instagram"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#", class: "icon fa-github"}, React.createElement("span", {class: "label"}, "Github"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#", class: "icon fa-envelope"}, React.createElement("span", {class: "label"}, "Email")))
                            )
                        )
                    )
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