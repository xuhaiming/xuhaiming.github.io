var ____Classx=React.Component;for(var ____Classx____Key in ____Classx){if(____Classx.hasOwnProperty(____Classx____Key)){MainContainer[____Classx____Key]=____Classx[____Classx____Key];}}var ____SuperProtoOf____Classx=____Classx===null?null:____Classx.prototype;MainContainer.prototype=Object.create(____SuperProtoOf____Classx);MainContainer.prototype.constructor=MainContainer;MainContainer.__superConstructor__=____Classx;function MainContainer(){"use strict";if(____Classx!==null){____Classx.apply(this,arguments);}}
    Object.defineProperty(MainContainer.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", {id: "main"}, 
                React.createElement(TopSection, null), 
                React.createElement(BlogListSection, null), 
                React.createElement(ContactSection, null),
                React.createElement(ContactSection, null)
            )
        );
    }});

