var ____Class6=React.Component;for(var ____Class6____Key in ____Class6){if(____Class6.hasOwnProperty(____Class6____Key)){BlogListSection[____Class6____Key]=____Class6[____Class6____Key];}}var ____SuperProtoOf____Class6=____Class6===null?null:____Class6.prototype;BlogListSection.prototype=Object.create(____SuperProtoOf____Class6);BlogListSection.prototype.constructor=BlogListSection;BlogListSection.__superConstructor__=____Class6;
    function BlogListSection() {"use strict";
        ____Class6.call(this);
        this.state = {
            blog: {}
        };
        $.get("http://haimingblogservice.azurewebsites.net/api/Posts", function(data)  {
            this.setState({blog: data.value[0]});
        }.bind(this));
    }

    Object.defineProperty(BlogListSection.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("section", {id: "blogs", className: "two"}, 
                React.createElement("div", {className: "container"}, 

                    React.createElement("header", null, 
                        React.createElement("h2", null, "Blogs")
                    ), 

                    React.createElement("p", null, "Vitae natoque dictum etiam semper magnis enim feugiat convallis convallis" + ' ' +
                        "egestas rhoncus ridiculus in quis risus amet curabitur tempor orci penatibus." + ' ' +
                        "Tellus erat mauris ipsum fermentum etiam vivamus eget. Nunc nibh morbi quis" + ' ' +
                        "fusce hendrerit lacus ridiculus."), 

                    React.createElement("div", {className: "row"}, 
                        React.createElement("div", {className: "4u 12u$(mobile)"}, 
                            React.createElement("article", {className: "item"}, 
                                React.createElement("a", {href: "#", className: "image fit"}, React.createElement("img", {
                                    src: "images/pic01.jpg", alt: ""})), 
                                React.createElement("header", null, 
                                    React.createElement("h3", null, this.state.blog.Title)
                                )
                            ), 
                            React.createElement("article", {className: "item"}, 
                                React.createElement("a", {href: "#", className: "image fit"}, React.createElement("img", {src: "images/pic03.jpg", alt: ""})), 
                                React.createElement("header", null, 
                                    React.createElement("h3", null, "Rhoncus Semper")
                                )
                            )
                        ), 
                        React.createElement("div", {className: "4u 12u$(mobile)"}, 
                            React.createElement("article", {className: "item"}, 
                                React.createElement("a", {href: "#", className: "image fit"}, React.createElement("img", {src: "images/pic04.jpg", alt: ""})), 
                                React.createElement("header", null, 
                                    React.createElement("h3", null, "Magna Nullam")
                                )
                            ), 
                            React.createElement("article", {className: "item"}, 
                                React.createElement("a", {href: "#", className: "image fit"}, React.createElement("img", {src: "images/pic05.jpg", alt: ""})), 
                                React.createElement("header", null, 
                                    React.createElement("h3", null, "Natoque Vitae")
                                )
                            )
                        ), 
                        React.createElement("div", {className: "4u$ 12u$(mobile)"}, 
                            React.createElement("article", {className: "item"}, 
                                React.createElement("a", {href: "#", className: "image fit"}, React.createElement("img", {src: "images/pic06.jpg", alt: ""})), 
                                React.createElement("header", null, 
                                    React.createElement("h3", null, "Dolor Penatibus")
                                )
                            ), 
                            React.createElement("article", {className: "item"}, 
                                React.createElement("a", {href: "#", className: "image fit"}, React.createElement("img", {src: "images/pic07.jpg", alt: ""})), 
                                React.createElement("header", null, 
                                    React.createElement("h3", null, "Orci Convallis")
                                )
                            )
                        )
                    )

                )
            )
        );
    }});
