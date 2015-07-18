var ____Class0=React.Component;for(var ____Class0____Key in ____Class0){if(____Class0.hasOwnProperty(____Class0____Key)){BlogContainer[____Class0____Key]=____Class0[____Class0____Key];}}var ____SuperProtoOf____Class0=____Class0===null?null:____Class0.prototype;BlogContainer.prototype=Object.create(____SuperProtoOf____Class0);BlogContainer.prototype.constructor=BlogContainer;BlogContainer.__superConstructor__=____Class0;function BlogContainer(){"use strict";if(____Class0!==null){____Class0.apply(this,arguments);}}
    Object.defineProperty(BlogContainer.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", {id: "main"}, 
                React.createElement("section", {className: "two"}, 
                    React.createElement("div", {className: "container"}, 
                        React.createElement("header", null, 
                            React.createElement("h2", null, this.props.blog.Title)
                        ), 

                        React.createElement("p", null, React.createElement("span", {dangerouslySetInnerHTML: {__html: this.props.blog.Content}}))
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

