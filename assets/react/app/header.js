var ____Classr=React.Component;for(var ____Classr____Key in ____Classr){if(____Classr.hasOwnProperty(____Classr____Key)){Header[____Classr____Key]=____Classr[____Classr____Key];}}var ____SuperProtoOf____Classr=____Classr===null?null:____Classr.prototype;Header.prototype=Object.create(____SuperProtoOf____Classr);Header.prototype.constructor=Header;Header.__superConstructor__=____Classr;
    function Header(props) {"use strict";
        ____Classr.call(this,props);
    }

    Object.defineProperty(Header.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        var getUrl = window.location;
        var baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
        var urlBaseString = this.props.isOnHomePage ? "" : baseUrl;

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
                            React.createElement("li", null, React.createElement("a", {href: urlBaseString + "#intro", id: "intro-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {
                                className: "icon fa-home"}, "Intro"))), 
                            React.createElement("li", null, React.createElement("a", {href: urlBaseString + "#blogs", id: "blogs-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {
                                className: "icon fa-th"}, "Blogs"))), 
                            React.createElement("li", null, React.createElement("a", {href: urlBaseString + "#about", id: "about-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {
                                className: "icon fa-user"}, "About Me"))), 
                            React.createElement("li", null, React.createElement("a", {href: urlBaseString + "#contact", id: "contact-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {
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
