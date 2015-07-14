var ____Classx=React.Component;for(var ____Classx____Key in ____Classx){if(____Classx.hasOwnProperty(____Classx____Key)){MainPage[____Classx____Key]=____Classx[____Classx____Key];}}var ____SuperProtoOf____Classx=____Classx===null?null:____Classx.prototype;MainPage.prototype=Object.create(____SuperProtoOf____Classx);MainPage.prototype.constructor=MainPage;MainPage.__superConstructor__=____Classx;
    function MainPage() {"use strict";
        ____Classx.call(this);
        this.state = {
            blog: {}
        };
        $.get( "http://haimingblogservice.azurewebsites.net/api/Posts", function( data ) {
            this.setState({blog: data.value[0]});
            console.log(data.value[0]);
        }.bind(this));
    }
    Object.defineProperty(MainPage.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", null, 
                React.createElement("div", {id: "header"}, 

                    React.createElement("div", {className: "top"}, 

                        React.createElement("div", {id: "logo"}, 
                            React.createElement("span", {className: "image avatar48"}, React.createElement("img", {src: "images/avatar.jpg", alt: ""})), 
                            React.createElement("h1", {id: "title"}, "Xu Haiming"), 
                            React.createElement("p", null, "Software Engineer")
                        ), 

                        React.createElement("nav", {id: "nav"}, 
                            React.createElement("ul", null, 
                                React.createElement("li", null, React.createElement("a", {href: "#top", id: "top-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {className: "icon fa-home"}, "Intro"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#blogs", id: "blogs-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {className: "icon fa-th"}, "Blogs"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#about", id: "about-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {className: "icon fa-user"}, "About Me"))), 
                                React.createElement("li", null, React.createElement("a", {href: "#contact", id: "contact-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {className: "icon fa-envelope"}, "Contact")))
                            )
                        )

                    ), 

                    React.createElement("div", {className: "bottom"}, 

                        React.createElement("ul", {className: "icons"}, 
                            React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-twitter"}, React.createElement("span", {className: "label"}, "Twitter"))), 
                            React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-facebook"}, React.createElement("span", {className: "label"}, "Facebook"))), 
                            React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-github"}, React.createElement("span", {className: "label"}, "Github"))), 
                            React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-dribbble"}, React.createElement("span", {className: "label"}, "Dribbble"))), 
                            React.createElement("li", null, React.createElement("a", {href: "#", className: "icon fa-envelope"}, React.createElement("span", {className: "label"}, "Email")))
                        )

                    )

                ), 

                React.createElement("div", {id: "main"}, 

                    React.createElement("section", {id: "top", className: "one dark cover"}, 
                        React.createElement("div", {className: "container"}, 

                            React.createElement("header", null, 
                                React.createElement("h2", {className: "alt"}, "This is my amazing blog page"), 
                                React.createElement("p", null, "It is super super super beautiful")
                            ), 

                            React.createElement("footer", null, 
                                React.createElement("a", {href: "#portfolio", className: "button scrolly"}, "A Useless Button")
                            )

                        )
                    ), 

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
                                        React.createElement("a", {href: "#", className: "image fit"}, React.createElement("img", {src: "images/pic0" + this.state.blog.Id + ".jpg", alt: ""})), 
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
                    ), 

                    React.createElement("section", {id: "about", className: "three"}, 
                        React.createElement("div", {className: "container"}, 

                            React.createElement("header", null, 
                                React.createElement("h2", null, "About Me")
                            ), 

                            React.createElement("a", {href: "#", className: "image featured"}, React.createElement("img", {src: "images/pic08.jpg", alt: ""})), 

                            React.createElement("p", null, "Tincidunt eu elit diam magnis pretium accumsan etiam id urna. Ridiculus" + ' ' +
                                "ultricies curae quis et rhoncus velit. Lobortis elementum aliquet nec vitae" + ' ' +
                                "laoreet eget cubilia quam non etiam odio tincidunt montes. Elementum sem" + ' ' +
                                "parturient nulla quam placerat viverra mauris non cum elit tempus ullamcorper" + ' ' +
                                "dolor. Libero rutrum ut lacinia donec curae mus vel quisque sociis nec" + ' ' +
                                "ornare iaculis.")

                        )
                    ), 

                    React.createElement("section", {id: "contact", className: "four"}, 
                        React.createElement("div", {className: "container"}, 

                            React.createElement("header", null, 
                                React.createElement("h2", null, "Contact")
                            ), 

                            React.createElement("p", null, "You can contact me by filling the information in the form below and" + ' ' +
                                "click the \"Send Message\" button. But finally you will find nothing happens."), 

                            React.createElement("form", {method: "post", action: "#"}, 
                                React.createElement("div", {className: "row"}, 
                                    React.createElement("div", {className: "6u 12u$(mobile)"}, React.createElement("input", {type: "text", name: "name", placeholder: "Name"})), 
                                    React.createElement("div", {className: "6u$ 12u$(mobile)"}, React.createElement("input", {type: "text", name: "email", placeholder: "Email"})), 
                                    React.createElement("div", {className: "12u$"}, 
                                        React.createElement("textarea", {name: "message", placeholder: "Message"})
                                    ), 
                                    React.createElement("div", {className: "12u$"}, 
                                        React.createElement("input", {type: "submit", value: "Send Message"})
                                    )
                                )
                            )

                        )
                    )

                ), 

                React.createElement("div", {id: "footer"}, 

                    React.createElement("ul", {className: "copyright"}, 
                        React.createElement("li", null, "© Xu Haiming. All rights reserved."), React.createElement("li", null, "2015")
                    )

                )
            )
        );
    }});


React.render(React.createElement(MainPage, null), document.getElementById('main-page'));