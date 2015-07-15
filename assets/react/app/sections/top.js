var ____Classg=React.Component;for(var ____Classg____Key in ____Classg){if(____Classg.hasOwnProperty(____Classg____Key)){TopSection[____Classg____Key]=____Classg[____Classg____Key];}}var ____SuperProtoOf____Classg=____Classg===null?null:____Classg.prototype;TopSection.prototype=Object.create(____SuperProtoOf____Classg);TopSection.prototype.constructor=TopSection;TopSection.__superConstructor__=____Classg;function TopSection(){"use strict";if(____Classg!==null){____Classg.apply(this,arguments);}}
    Object.defineProperty(TopSection.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("section", {id: "intro", className: "one dark cover"}, 
                React.createElement("div", {className: "container"}, 

                    React.createElement("header", null, 
                        React.createElement("h2", {className: "alt"}, "This is my amazing blog page"), 

                        React.createElement("p", null, "It is super super super beautiful")
                    ), 

                    React.createElement("footer", null, 
                        React.createElement("a", {href: "#portfolio", className: "button scrolly"}, "A Useless Button")
                    )

                )
            )
        );
    }});
