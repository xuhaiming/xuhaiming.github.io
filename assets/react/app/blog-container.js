var ____Class6=React.Component;for(var ____Class6____Key in ____Class6){if(____Class6.hasOwnProperty(____Class6____Key)){BlogContainer[____Class6____Key]=____Class6[____Class6____Key];}}var ____SuperProtoOf____Class6=____Class6===null?null:____Class6.prototype;BlogContainer.prototype=Object.create(____SuperProtoOf____Class6);BlogContainer.prototype.constructor=BlogContainer;BlogContainer.__superConstructor__=____Class6;function BlogContainer(){"use strict";if(____Class6!==null){____Class6.apply(this,arguments);}}
    Object.defineProperty(BlogContainer.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", {id: "main"}, 
                React.createElement("section", {id: "blog-container", className: "two"}, 
                    React.createElement("div", {className: "container"}, 
                        "This is my blog detail page"
                    )
                ), 
                React.createElement("section", {id: "blogs", className: "three"}, 
                    React.createElement("div", {className: "container"}, 
                        "This part will be used for comments"
                    )
                )
            )
        );
    }});

