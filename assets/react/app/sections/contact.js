var ____Classw=React.Component;for(var ____Classw____Key in ____Classw){if(____Classw.hasOwnProperty(____Classw____Key)){ContactSection[____Classw____Key]=____Classw[____Classw____Key];}}var ____SuperProtoOf____Classw=____Classw===null?null:____Classw.prototype;ContactSection.prototype=Object.create(____SuperProtoOf____Classw);ContactSection.prototype.constructor=ContactSection;ContactSection.__superConstructor__=____Classw;function ContactSection(){"use strict";if(____Classw!==null){____Classw.apply(this,arguments);}}
    Object.defineProperty(ContactSection.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("section", {id: "contact", className: "four"}, 
                React.createElement("div", {className: "container"}, 

                    React.createElement("header", null, 
                        React.createElement("h2", null, "Contact")
                    ), 

                    React.createElement("p", null, "You can contact me by filling the information in the form below and" + ' ' +
                        "click the \"Send Message\" button. But finally you will find nothing happens."), 

                    React.createElement("form", {method: "post", action: "#"}, 
                        React.createElement("div", {className: "row"}, 
                            React.createElement("div", {className: "6u 12u$(mobile)"}, React.createElement("input", {type: "text", name: "name", placeholder: "Name"})
                            ), 
                            React.createElement("div", {className: "6u$ 12u$(mobile)"}, React.createElement("input", {type: "text", name: "email", 
                                                                     placeholder: "Email"})), 
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
        );
    }});
