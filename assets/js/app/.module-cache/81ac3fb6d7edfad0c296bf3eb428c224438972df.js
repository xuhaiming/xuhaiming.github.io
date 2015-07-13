define(['react', 'jquery', 'skel', 'skelLayers', 'init'], function(React, $, myskel, skelLayers, init) {
    return React.createClass({
        componentWillMount: function(){
            $.get( "http://brainportcloud.cloudapp.net/company", function( data ) {
                console.log(data);
            });
        },
        render: function () {
            return (
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
                )
            );
        }

    });


});