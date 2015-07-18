var ____Classs=React.Component;for(var ____Classs____Key in ____Classs){if(____Classs.hasOwnProperty(____Classs____Key)){BlogContainer[____Classs____Key]=____Classs[____Classs____Key];}}var ____SuperProtoOf____Classs=____Classs===null?null:____Classs.prototype;BlogContainer.prototype=Object.create(____SuperProtoOf____Classs);BlogContainer.prototype.constructor=BlogContainer;BlogContainer.__superConstructor__=____Classs;function BlogContainer(){"use strict";if(____Classs!==null){____Classs.apply(this,arguments);}}
    Object.defineProperty(BlogContainer.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", {id: "main"}, 
                React.createElement("section", {className: "two"}, 
                    React.createElement("div", {className: "container"}, 
                        React.createElement("header", null, 
                            React.createElement("h2", null, this.props.blog.Title)
                        ), 

                        React.createElement("p", null, this.props.blog.Content)
                    )
                ), 
                React.createElement("section", {className: "two"}, 
                    React.createElement("div", {className: "container"}, 
                        "This part will be used for comments"
                    )
                )
            )
        );
    }});

