var ____Classq=React.Component;for(var ____Classq____Key in ____Classq){if(____Classq.hasOwnProperty(____Classq____Key)){BlogListSection[____Classq____Key]=____Classq[____Classq____Key];}}var ____SuperProtoOf____Classq=____Classq===null?null:____Classq.prototype;BlogListSection.prototype=Object.create(____SuperProtoOf____Classq);BlogListSection.prototype.constructor=BlogListSection;BlogListSection.__superConstructor__=____Classq;
    function BlogListSection() {"use strict";
        ____Classq.call(this);
        this.state = {
            blog: {}
        };
        $.get("http://haimingblogservice.azurewebsites.net/api/Posts", function (data) {
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
                                    src: "images/pic0" + this.state.blog.Id + ".jpg", alt: ""})), 
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
