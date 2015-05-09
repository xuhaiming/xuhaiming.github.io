define(['react', 'jquery', 'skel', 'skelLayers', 'init'], function(React, $, myskel, skelLayers, init) {
        var MainPage = React.createClass({displayName: "MainPage",
            componentDidMount: function() {

            },
            render: function(){
                return (
                React.createElement("div", {id: "wrapper"}, 

                    React.createElement("div", {id: "content"}, 
                        React.createElement("div", {className: "inner"}, 

                            React.createElement("article", {className: "box post post-excerpt"}, 
                                React.createElement("header", null, 
                                    React.createElement("h2", null, React.createElement("a", {href: "#"}, "Welcome to Striped")), 
                                    React.createElement("p", null, "A free, fully responsive HTML5 site template by HTML5 UP")
                                ), 
                                React.createElement("div", {className: "info"}, 
                                    React.createElement("span", {className: "date"}, React.createElement("span", {className: "month"}, "Jul", React.createElement("span", null, "y")), " ", React.createElement("span", {className: "day"}, "14"), React.createElement("span", {className: "year"}, ", 2014")), 
                                    React.createElement("ul", {className: "stats"}, 
                                        React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-comment"}, "16")), 
                                        React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-heart"}, "32")), 
                                        React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-twitter"}, "64")), 
                                        React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-facebook"}, "128"))
                                    )
                                ), 
                                React.createElement("a", {href: "#", className: "image featured"}, React.createElement("img", {src: "images/pic01.jpg", alt: ""})), 
                                React.createElement("p", null, 
                                    React.createElement("strong", null, "Hello!"), " You're looking at ", React.createElement("strong", null, "Striped"), ", a fully responsive HTML5 site template designed by ", React.createElement("a", {href: "http://n33.co"}, "AJ"), 
                                    "for ", React.createElement("a", {href: "http://html5up.net"}, "HTML5 UP"), " It features a clean, minimalistic design, styling for all basic page elements (including blockquotes, tables and lists), a" + ' ' +
                                    "repositionable sidebar (left or right), and HTML5/CSS3 code designed for quick and easy customization (see code comments for details)."
                                ), 
                                React.createElement("p", null, 
                                    "Striped is released for free under the ", React.createElement("a", {href: "http://html5up.net/license"}, "Creative Commons Attribution license"), " so feel free to use it for personal projects" + ' ' +
                                    "or even commercial ones – just be sure to credit ", React.createElement("a", {href: "http://html5up.net"}, "HTML5 UP"), " for the design. If you like what you see here, be sure to check out", 
                                    React.createElement("a", {href: "http://html5up.net"}, "HTML5 UP"), " for more cool designs or follow me on ", React.createElement("a", {href: "http://twitter.com/n33co"}, "Twitter"), " for new releases and updates."
                                )
                            ), 

                            React.createElement("article", {className: "box post post-excerpt"}, 
                                React.createElement("header", null, 
                                    React.createElement("h2", null, React.createElement("a", {href: "#"}, "Lorem ipsum dolor sit amet")), 
                                    React.createElement("p", null, "Feugiat interdum sed commodo ipsum consequat dolor nullam metus")
                                ), 
                                React.createElement("div", {className: "info"}, 
                                    React.createElement("span", {className: "date"}, React.createElement("span", {className: "month"}, "Jul", React.createElement("span", null, "y")), " ", React.createElement("span", {className: "day"}, "8"), React.createElement("span", {className: "year"}, ", 2014")), 
                                    React.createElement("ul", {className: "stats"}, 
                                        React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-comment"}, "16")), 
                                        React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-heart"}, "32")), 
                                        React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-twitter"}, "64")), 
                                        React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-facebook"}, "128"))
                                    )
                                ), 
                                React.createElement("a", {href: "#", className: "image featured"}, React.createElement("img", {src: "images/pic02.jpg", alt: ""})), 
                                React.createElement("p", null, 
                                    "Quisque vel sapien sit amet tellus elementum ultricies. Nunc vel orci turpis. Donec id malesuada metus." + ' ' +
                                    "Nunc nulla velit, fermentum quis interdum quis, tate etiam commodo lorem ipsum dolor sit amet dolore." + ' ' +
                                    "Quisque vel sapien sit amet tellus elementum ultricies. Nunc vel orci turpis. Donec id malesuada metus." + ' ' +
                                    "Nunc nulla velit, fermentum quis interdum quis, convallis eu sapien. Integer sed ipsum ante."
                                )
                            ), 

                            React.createElement("div", {className: "pagination"}, 
                                React.createElement("a", {href: "#", className: "button previous"}, "Previous Page"), 
                                React.createElement("div", {className: "pages"}, 
                                    React.createElement("a", {href: "#", className: "active"}, "1"), 
                                    React.createElement("a", {href: "#"}, "2"), 
                                    React.createElement("a", {href: "#"}, "3"), 
                                    React.createElement("a", {href: "#"}, "4"), 
                                    React.createElement("span", null, "…"), 
                                    React.createElement("a", {href: "#"}, "20")
                                ), 
                                React.createElement("a", {href: "#", className: "button next"}, "Next Page")
                            )

                        )
                    ), 

                    React.createElement("div", {id: "sidebar"}, 

                        React.createElement("h1", {id: "logo"}, React.createElement("a", {href: "#"}, "STRIPED")), 

                        React.createElement("nav", {id: "nav"}, 
                            React.createElement("ul", null, 
                                React.createElement("li", {className: "current"}, React.createElement("a", {href: "#"}, "Latest Post")), 
                                React.createElement("li", null, React.createElement("a", {href: "#"}, "Archives")), 
                                React.createElement("li", null, React.createElement("a", {href: "#"}, "About Me")), 
                                React.createElement("li", null, React.createElement("a", {href: "#"}, "Contact Me"))
                            )
                        ), 

                        React.createElement("section", {className: "box search"}, 
                            React.createElement("form", {method: "post", action: "#"}, 
                                React.createElement("input", {type: "text", className: "text", name: "search", placeholder: "Search"})
                            )
                        ), 

                        React.createElement("section", {className: "box text-style1"}, 
                            React.createElement("div", {className: "inner"}, 
                                React.createElement("p", null, 
                                    React.createElement("strong", null, "Striped:"), " A free and fully responsive HTML5 site" + ' ' +
                                    "template designed by ", React.createElement("a", {href: "http://n33.co/"}, "AJ"), " for ", React.createElement("a", {href: "http://html5up.net/"}, "HTML5 UP")
                                )
                            )
                        ), 

                        React.createElement("section", {className: "box recent-posts"}, 
                            React.createElement("header", null, 
                                React.createElement("h2", null, "Recent Posts")
                            ), 
                            React.createElement("ul", null, 
                                React.createElement("li", null, React.createElement("a", {href: "#"}, "Lorem ipsum dolor")), 
                                React.createElement("li", null, React.createElement("a", {href: "#"}, "Feugiat nisl aliquam")), 
                                React.createElement("li", null, React.createElement("a", {href: "#"}, "Sed dolore magna")), 
                                React.createElement("li", null, React.createElement("a", {href: "#"}, "Malesuada commodo")), 
                                React.createElement("li", null, React.createElement("a", {href: "#"}, "Ipsum metus nullam"))
                            )
                        ), 

                        React.createElement("section", {className: "box recent-comments"}, 
                            React.createElement("header", null, 
                                React.createElement("h2", null, "Recent Comments")
                            ), 
                            React.createElement("ul", null, 
                                React.createElement("li", null, "case on ", React.createElement("a", {href: "#"}, "Lorem ipsum dolor")), 
                                React.createElement("li", null, "molly on ", React.createElement("a", {href: "#"}, "Sed dolore magna")), 
                                React.createElement("li", null, "case on ", React.createElement("a", {href: "#"}, "Sed dolore magna"))
                            )
                        ), 

                        React.createElement("section", {className: "box calendar"}, 
                            React.createElement("div", {className: "inner"}, 
                                React.createElement("table", null, 
                                    React.createElement("caption", null, "July 2014"), 
                                    React.createElement("thead", null, 
                                        React.createElement("tr", null, 
                                            React.createElement("th", {scope: "col", title: "Monday"}, "M"), 
                                            React.createElement("th", {scope: "col", title: "Tuesday"}, "T"), 
                                            React.createElement("th", {scope: "col", title: "Wednesday"}, "W"), 
                                            React.createElement("th", {scope: "col", title: "Thursday"}, "T"), 
                                            React.createElement("th", {scope: "col", title: "Friday"}, "F"), 
                                            React.createElement("th", {scope: "col", title: "Saturday"}, "S"), 
                                            React.createElement("th", {scope: "col", title: "Sunday"}, "S")
                                        )
                                    ), 
                                    React.createElement("tbody", null, 
                                        React.createElement("tr", null, 
                                            React.createElement("td", {colspan: "4", className: "pad"}, React.createElement("span", null, " ")), 
                                            React.createElement("td", null, React.createElement("span", null, "1")), 
                                            React.createElement("td", null, React.createElement("span", null, "2")), 
                                            React.createElement("td", null, React.createElement("span", null, "3"))
                                        ), 
                                        React.createElement("tr", null, 
                                            React.createElement("td", null, React.createElement("span", null, "4")), 
                                            React.createElement("td", null, React.createElement("span", null, "5")), 
                                            React.createElement("td", null, React.createElement("a", {href: "#"}, "6")), 
                                            React.createElement("td", null, React.createElement("span", null, "7")), 
                                            React.createElement("td", null, React.createElement("span", null, "8")), 
                                            React.createElement("td", null, React.createElement("span", null, "9")), 
                                            React.createElement("td", null, React.createElement("a", {href: "#"}, "10"))
                                        ), 
                                        React.createElement("tr", null, 
                                            React.createElement("td", null, React.createElement("span", null, "11")), 
                                            React.createElement("td", null, React.createElement("span", null, "12")), 
                                            React.createElement("td", null, React.createElement("span", null, "13")), 
                                            React.createElement("td", {className: "today"}, React.createElement("a", {href: "#"}, "14")), 
                                            React.createElement("td", null, React.createElement("span", null, "15")), 
                                            React.createElement("td", null, React.createElement("span", null, "16")), 
                                            React.createElement("td", null, React.createElement("span", null, "17"))
                                        ), 
                                        React.createElement("tr", null, 
                                            React.createElement("td", null, React.createElement("span", null, "18")), 
                                            React.createElement("td", null, React.createElement("span", null, "19")), 
                                            React.createElement("td", null, React.createElement("span", null, "20")), 
                                            React.createElement("td", null, React.createElement("span", null, "21")), 
                                            React.createElement("td", null, React.createElement("span", null, "22")), 
                                            React.createElement("td", null, React.createElement("a", {href: "#"}, "23")), 
                                            React.createElement("td", null, React.createElement("span", null, "24"))
                                        ), 
                                        React.createElement("tr", null, 
                                            React.createElement("td", null, React.createElement("a", {href: "#"}, "25")), 
                                            React.createElement("td", null, React.createElement("span", null, "26")), 
                                            React.createElement("td", null, React.createElement("span", null, "27")), 
                                            React.createElement("td", null, React.createElement("span", null, "28")), 
                                            React.createElement("td", {className: "pad", colspan: "3"}, React.createElement("span", null, " "))
                                        )
                                    )
                                )
                            )
                        ), 

                        React.createElement("ul", {id: "copyright"}, 
                            React.createElement("li", null, "© Untitled."), React.createElement("li", null, "Design: ", React.createElement("a", {href: "http://html5up.net"}, "HTML5 UP"))
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