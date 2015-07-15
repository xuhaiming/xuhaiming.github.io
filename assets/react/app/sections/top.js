var ____Classj=React.Component;for(var ____Classj____Key in ____Classj){if(____Classj.hasOwnProperty(____Classj____Key)){TopSection[____Classj____Key]=____Classj[____Classj____Key];}}var ____SuperProtoOf____Classj=____Classj===null?null:____Classj.prototype;TopSection.prototype=Object.create(____SuperProtoOf____Classj);TopSection.prototype.constructor=TopSection;TopSection.__superConstructor__=____Classj;function TopSection(){"use strict";if(____Classj!==null){____Classj.apply(this,arguments);}}
    Object.defineProperty(TopSection.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
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
            )
        );
    }});
