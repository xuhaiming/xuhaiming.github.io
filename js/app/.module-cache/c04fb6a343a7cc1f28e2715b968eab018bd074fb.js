define(['react', 'jquery', 'skel', 'skelLayers', 'init', 'boxCalendar'], function(React, $, myskel, skelLayers, init, BoxCalendar) {
        var SideBar = React.createClass({displayName: "SideBar",
            componentDidMount: function () {

            },
            render: function () {
                return (
                    React.createElement("div", {id: "sidebar"}, 

                        React.createElement("h1", {id: "logo"}, 
                            React.createElement("a", {href: "#"}, "STRIPED")
                        ), 

                        React.createElement("nav", {id: "nav"}, 
                            React.createElement("ul", null, 
                                React.createElement("li", {className: "current"}, 
                                    React.createElement("a", {href: "#"}, "Latest Post")
                                ), 
                                React.createElement("li", null, 
                                    React.createElement("a", {href: "#"}, "Archives")
                                ), 
                                React.createElement("li", null, 
                                    React.createElement("a", {href: "#"}, "About Me")
                                ), 
                                React.createElement("li", null, 
                                    React.createElement("a", {href: "#"}, "Contact Me")
                                )
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
                                    React.createElement("strong", null, "Striped:"), 
                                    "A free and fully responsive HTML5 site" + ' ' +
                                    "template designed by", 
                                    React.createElement("a", {href: "http://n33.co/"}, "AJ"), 
                                    "for", 
                                    React.createElement("a", {href: "http://html5up.net/"}, "HTML5 UP")
                                )
                            )
                        ), 

                        React.createElement("section", {className: "box recent-posts"}, 
                            React.createElement("header", null, 
                                React.createElement("h2", null, "Recent Posts")
                            ), 
                            React.createElement("ul", null, 
                                React.createElement("li", null, 
                                    React.createElement("a", {href: "#"}, "Lorem ipsum dolor")
                                ), 
                                React.createElement("li", null, 
                                    React.createElement("a", {href: "#"}, "Feugiat nisl aliquam")
                                ), 
                                React.createElement("li", null, 
                                    React.createElement("a", {href: "#"}, "Sed dolore magna")
                                ), 
                                React.createElement("li", null, 
                                    React.createElement("a", {href: "#"}, "Malesuada commodo")
                                ), 
                                React.createElement("li", null, 
                                    React.createElement("a", {href: "#"}, "Ipsum metus nullam")
                                )
                            )
                        ), 

                        React.createElement("section", {className: "box recent-comments"}, 
                            React.createElement("header", null, 
                                React.createElement("h2", null, "Recent Comments")
                            ), 
                            React.createElement("ul", null, 
                                React.createElement("li", null, "case on", 
                                    React.createElement("a", {href: "#"}, "Lorem ipsum dolor")
                                ), 
                                React.createElement("li", null, "molly on", 
                                    React.createElement("a", {href: "#"}, "Sed dolore magna")
                                ), 
                                React.createElement("li", null, "case on", 
                                    React.createElement("a", {href: "#"}, "Sed dolore magna")
                                )
                            )
                        ), 

                        React.createElement(BoxCalendar, null), 

                        React.createElement("ul", {id: "copyright"}, 
                            React.createElement("li", null, "© Untitled."), 
                            React.createElement("li", null, "Design:", 
                                React.createElement("a", {href: "http://html5up.net"}, "HTML5 UP")
                            )
                        )

                    )

                )
            }
        });

    return SideBar;
});