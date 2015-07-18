var ____Class1=React.Component;for(var ____Class1____Key in ____Class1){if(____Class1.hasOwnProperty(____Class1____Key)){Header[____Class1____Key]=____Class1[____Class1____Key];}}var ____SuperProtoOf____Class1=____Class1===null?null:____Class1.prototype;Header.prototype=Object.create(____SuperProtoOf____Class1);Header.prototype.constructor=Header;Header.__superConstructor__=____Class1;
    function Header(props) {"use strict";
        ____Class1.call(this,props);
    }

    Object.defineProperty(Header.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        var getUrl = window.location;
        var baseUrl = getUrl .protocol + "//" + getUrl.host + "/";
        baseUrl = getUrl.host === "xuhaiming.github.io" ? baseUrl : baseUrl + getUrl.pathname.split('/')[1];
        var isOnMainPage = this.props.isOnMainPage;
        var urlBaseString = isOnMainPage ? "" : baseUrl;

        return (
            React.createElement("div", {id: "header"}, 

                React.createElement("div", {className: "top"}, 

                    React.createElement("div", {id: "logo"}, 
                        React.createElement("span", {className: "image avatar48"}, React.createElement("img", {src: baseUrl + "/images/avatar.jpg", alt: ""})), 

                        React.createElement("h1", {id: "title"}, "Xu Haiming"), 

                        React.createElement("p", null, "Software Engineer")
                    ), 

                    React.createElement("nav", {id: "nav"}, 
                        React.createElement("ul", null, 
                            React.createElement("li", null, React.createElement("a", {href: urlBaseString + "#intro", id: "intro-link", className: "skel-layers-ignoreHref"}, React.createElement("span", {
                                className: "icon fa-home"}, "Intro"))), 
                            React.createElement("li", null, React.createElement("a", {href: urlBaseString + "#blogs", id: "blogs-link", className: isOnMainPage ? "skel-layers-ignoreHref" : "skel-layers-ignoreHref active"}, React.createElement("span", {
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
