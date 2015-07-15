var ____Classm=React.Component;for(var ____Classm____Key in ____Classm){if(____Classm.hasOwnProperty(____Classm____Key)){Header[____Classm____Key]=____Classm[____Classm____Key];}}var ____SuperProtoOf____Classm=____Classm===null?null:____Classm.prototype;Header.prototype=Object.create(____SuperProtoOf____Classm);Header.prototype.constructor=Header;Header.__superConstructor__=____Classm;function Header(){"use strict";if(____Classm!==null){____Classm.apply(this,arguments);}}
    Object.defineProperty(Header.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", {id: "header"}, 

                React.createElement("div", {className: "top"}, 

                    React.createElement("div", {id: "logo"}, 
                        React.createElement("span", {className: "image avatar48"}, React.createElement("img", {src: "images/avatar.jpg", alt: ""})), 

                        React.createElement("h1", {id: "title"}, "Xu Haiming"), 

                        React.createElement("p", null, "Software Engineer")
                    ), 

                    React.createElement("nav", {id: "nav"}, 
                        React.createElement("ul", null, 
                            React.createElement("li", null, React.createElement("a", {href: "#top", id: "top-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {
                                className: "icon fa-home"}, "Intro"))), 
                            React.createElement("li", null, React.createElement("a", {href: "#blogs", id: "blogs-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {
                                className: "icon fa-th"}, "Blogs"))), 
                            React.createElement("li", null, React.createElement("a", {href: "#about", id: "about-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {
                                className: "icon fa-user"}, "About Me"))), 
                            React.createElement("li", null, React.createElement("a", {href: "#contact", id: "contact-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {
                                className: "icon fa-envelope"}, "Contact")))
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

            )
        )
    }});
