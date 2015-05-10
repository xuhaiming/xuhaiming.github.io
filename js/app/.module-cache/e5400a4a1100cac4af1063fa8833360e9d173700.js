define(['react', 'jquery', 'skel', 'skelLayers', 'init'], function(React, $, myskel, skelLayers, init) {
    var BoxCalendar = React.createClass({displayName: "BoxCalendar",
        componentDidMount: function () {

        },
        render: function () {
            return (
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
                                    React.createElement("td", {colspan: "4", className: "pad"}, 
                                        React.createElement("span", null, " ")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "1")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "2")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "3")
                                    )
                                ), 
                                React.createElement("tr", null, 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "4")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "5")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("a", {href: "#"}, "6")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "7")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "8")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "9")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("a", {href: "#"}, "10")
                                    )
                                ), 
                                React.createElement("tr", null, 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "11")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "12")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "13")
                                    ), 
                                    React.createElement("td", {className: "today"}, 
                                        React.createElement("a", {href: "#"}, "14")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "15")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "16")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "17")
                                    )
                                ), 
                                React.createElement("tr", null, 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "18")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "19")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "20")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "21")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "22")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("a", {href: "#"}, "23")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "24")
                                    )
                                ), 
                                React.createElement("tr", null, 
                                    React.createElement("td", null, 
                                        React.createElement("a", {href: "#"}, "25")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "26")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "27")
                                    ), 
                                    React.createElement("td", null, 
                                        React.createElement("span", null, "28")
                                    ), 
                                    React.createElement("td", {className: "pad", colspan: "3"}, 
                                        React.createElement("span", null, " ")
                                    )
                                )
                            )
                        )
                    )
                )
            );
        }

    });

    return BoxCalendar;
});