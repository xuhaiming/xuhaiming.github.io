define(['react', 'jquery', 'skel', 'skelLayers', 'init'], function(React, $, myskel, skelLayers, init) {
    var SideBar = React.createClass({displayName: "SideBar",
        componentDidMount: function() {

        },
        render: function(){
            return (
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
        }
    });

});