define(['react', 'jquery', 'skel', 'skelLayers', 'init'], function(React, $, myskel, skelLayers, init) {
    return React.createClass({
        getInitialState: function() {
            return {
                posts: []
            };
        },
        componentDidMount: function(){
            $.get( "http://haimingblogservice.azurewebsites.net/api/Posts", function( data ) {
                this.setState({
                    posts: data.value
                });
            }.bind(this));
        },
        getMonth: function(){
            var month = new Array();
                month[0] = "Jan";
                month[1] = "Feb";
                month[2] = "Mar";
                month[3] = "Apr";
                month[4] = "May";
                month[5] = "June";
                month[6] = "July";
                month[7] = "Aug";
                month[8] = "Sep";
                month[9] = "Oct";
                month[10] = "Nov";
                month[11] = "Dec";
            return month;
        },
        render: function () {
            var Posts = this.state.posts.map(function(data){
                var parsedDate = new Date(data.PublishDate);
                var month = this.getMonth();
                return (
                    React.createElement("article", {className: "box post post-excerpt"}, 
                        React.createElement("header", null, 
                            React.createElement("h2", null, React.createElement("a", {href: "#"}, data.Title)), 
                            React.createElement("p", null, data.SubTitle)
                        ), 
                        React.createElement("div", {className: "info"}, 
                            React.createElement("span", {className: "date"}, React.createElement("span", {className: "month"}, month[parsedDate.getMonth()], React.createElement("span", null, " ", parsedDate.getYear() - 100)), " ", React.createElement("span", {className: "day"}, parsedDate.getDate()), React.createElement("span", {className: "year"}, ", ", parsedDate.getFullYear())), 
                            React.createElement("ul", {className: "stats"}, 
                                React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-comment"}, "16")), 
                                React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-heart"}, "32"))
                            )
                        ), 
                        React.createElement("span", {dangerouslySetInnerHTML: {__html: data.Content}})
                    )
                );
            }.bind(this));
            return (
                React.createElement("div", {id: "content"}, 
                    React.createElement("div", {className: "inner"}, 
                        Posts, 

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