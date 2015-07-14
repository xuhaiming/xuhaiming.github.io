define(['react', 'jquery', 'util'],
    function(React) {
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
                //initializeRoute();
            },
            render: function(){
                return (
                React.createElement("div", null, 
                    React.createElement("section", {id: "header"}, 
                        React.createElement("header", null, 
                            React.createElement("span", {className: "image avatar"}, React.createElement("img", {src: "images/avatar.jpg", alt: ""})), 
                            React.createElement("h1", {id: "logo"}, React.createElement("a", {href: "#"}, "Willis Corto")), 
                            React.createElement("p", null, "I got reprogrammed by a rogue AI", React.createElement("br", null), 
                                "and now I'm totally cray")
                        ), 
                        React.createElement("nav", {id: "nav"}, 
                            React.createElement("ul", null, 
                                React.createElement("li", null, React.createElement("a", {href: "#one", className: "active"}, "About")), 
                                React.createElement("li", null, React.createElement("a", {href: "#two"}, "Things I Can Do")), 
                                React.createElement("li", null, React.createElement("a", {href: "#three"}, "A Few Accomplishments")), 
                                React.createElement("li", null, React.createElement("a", {href: "#four"}, "Contact"))
                            )
                        ), 
                        React.createElement("footer", null, 
                            React.createElement("ul", {className: "icons"}, 
                                React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-twitter"}, React.createElement("span", {className: "label"}, "Twitter"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-facebook"}, React.createElement("span", {className: "label"}, "Facebook"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-instagram"}, React.createElement("span", {className: "label"}, "Instagram"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-github"}, React.createElement("span", {className: "label"}, "Github"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-envelope"}, React.createElement("span", {className: "label"}, "Email")))
                            )
                        )
                    ), 

                    React.createElement("div", {id: "wrapper"}, 

                        React.createElement("div", {id: "main"}, 

                            React.createElement("section", {id: "one"}, 
                                React.createElement("div", {className: "container"}, 
                                    React.createElement("header", {className: "major"}, 
                                        React.createElement("h2", null, "Read Only"), 
                                        React.createElement("p", null, "Just an incredibly simple responsive site", React.createElement("br", null), 
                                            "template freebie by ", React.createElement("a", {href: "http://html5up.net"}, "HTML5 UP"), ".")
                                    ), 
                                    React.createElement("p", null, "Faucibus sed lobortis aliquam lorem blandit. Lorem eu nunc metus col. Commodo id in arcu ante lorem ipsum sed accumsan erat praesent faucibus commodo ac mi lacus. Adipiscing mi ac commodo. Vis aliquet tortor ultricies non ante erat nunc integer eu ante ornare amet commetus vestibulum blandit integer in curae ac faucibus integer non. Adipiscing cubilia elementum.")
                                )
                            ), 

                            React.createElement("section", {id: "two"}, 
                                React.createElement("div", {className: "container"}, 
                                    React.createElement("h3", null, "Things I Can Do"), 
                                    React.createElement("p", null, "Integer eu ante ornare amet commetus vestibulum blandit integer in curae ac faucibus integer non. Adipiscing cubilia elementum integer lorem ipsum dolor sit amet."), 
                                    React.createElement("ul", {className: "feature-icons"}, 
                                        React.createElement("li", {className: "fa-code"}, "Write all the code"), 
                                        React.createElement("li", {className: "fa-cubes"}, "Stack small boxes"), 
                                        React.createElement("li", {className: "fa-book"}, "Read books and stuff"), 
                                        React.createElement("li", {className: "fa-coffee"}, "Drink much coffee"), 
                                        React.createElement("li", {className: "fa-bolt"}, "Lightning bolt"), 
                                        React.createElement("li", {className: "fa-users"}, "Shadow clone technique")
                                    )
                                )
                            ), 

                            React.createElement("section", {id: "three"}, 
                                React.createElement("div", {className: "container"}, 
                                    React.createElement("h3", null, "A Few Accomplishments"), 
                                    React.createElement("p", null, "Integer eu ante ornare amet commetus vestibulum blandit integer in curae ac faucibus integer non. Adipiscing cubilia elementum integer. Integer eu ante ornare amet commetus."), 
                                    React.createElement("div", {className: "features"}, 
                                        React.createElement("article", null, 
                                            React.createElement("a", {href: "#", className: "image"}, React.createElement("img", {src: "images/pic01.jpg", alt: ""})), 
                                            React.createElement("div", {className: "inner"}, 
                                                React.createElement("h4", null, "Possibly broke spacetime"), 
                                                React.createElement("p", null, "Integer eu ante ornare amet commetus vestibulum blandit integer in curae ac faucibus integer adipiscing ornare amet.")
                                            )
                                        ), 
                                        React.createElement("article", null, 
                                            React.createElement("a", {href: "#", className: "image"}, React.createElement("img", {src: "images/pic02.jpg", alt: ""})), 
                                            React.createElement("div", {className: "inner"}, 
                                                React.createElement("h4", null, "Terraformed a small moon"), 
                                                React.createElement("p", null, "Integer eu ante ornare amet commetus vestibulum blandit integer in curae ac faucibus integer adipiscing ornare amet.")
                                            )
                                        ), 
                                        React.createElement("article", null, 
                                            React.createElement("a", {href: "#", className: "image"}, React.createElement("img", {src: "images/pic03.jpg", alt: ""})), 
                                            React.createElement("div", {className: "inner"}, 
                                                React.createElement("h4", null, "Snapped dark matter in the wild"), 
                                                React.createElement("p", null, "Integer eu ante ornare amet commetus vestibulum blandit integer in curae ac faucibus integer adipiscing ornare amet.")
                                            )
                                        )
                                    )
                                )
                            ), 

                            React.createElement("section", {id: "four"}, 
                                React.createElement("div", {className: "container"}, 
                                    React.createElement("h3", null, "Contact Me"), 
                                    React.createElement("p", null, "Integer eu ante ornare amet commetus vestibulum blandit integer in curae ac faucibus integer non. Adipiscing cubilia elementum integer. Integer eu ante ornare amet commetus."), 
                                    React.createElement("form", {method: "post", action: "#"}, 
                                        React.createElement("div", {className: "row uniform"}, 
                                            React.createElement("div", {className: "6u 12u(xsmall)"}, React.createElement("input", {type: "text", name: "name", id: "name", placeholder: "Name"})), 
                                            React.createElement("div", {className: "6u 12u(xsmall)"}, React.createElement("input", {type: "email", name: "email", id: "email", placeholder: "Email"}))
                                        ), 
                                        React.createElement("div", {className: "row uniform"}, 
                                            React.createElement("div", {className: "12u"}, React.createElement("input", {type: "text", name: "subject", id: "subject", placeholder: "Subject"}))
                                        ), 
                                        React.createElement("div", {className: "row uniform"}, 
                                            React.createElement("div", {className: "12u"}, React.createElement("textarea", {name: "message", id: "message", placeholder: "Message", rows: "6"}))
                                        ), 
                                        React.createElement("div", {className: "row uniform"}, 
                                            React.createElement("div", {className: "12u"}, 
                                                React.createElement("ul", {className: "actions"}, 
                                                    React.createElement("li", null, React.createElement("input", {type: "submit", className: "special", value: "Send Message"})), 
                                                    React.createElement("li", null, React.createElement("input", {type: "reset", value: "Reset Form"}))
                                                )
                                            )
                                        )
                                    )
                                )
                            )

                        ), 

                        React.createElement("section", {id: "footer"}, 
                            React.createElement("div", {className: "container"}, 
                                React.createElement("ul", {className: "copyright"}, 
                                    React.createElement("li", null, "© Untitled. All rights reserved."), React.createElement("li", null, "Design: ", React.createElement("a", {href: "http://html5up.net"}, "HTML5 UP"))
                                )
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