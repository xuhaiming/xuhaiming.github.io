var ____Class2=React.Component;for(var ____Class2____Key in ____Class2){if(____Class2.hasOwnProperty(____Class2____Key)){BlogContainer[____Class2____Key]=____Class2[____Class2____Key];}}var ____SuperProtoOf____Class2=____Class2===null?null:____Class2.prototype;BlogContainer.prototype=Object.create(____SuperProtoOf____Class2);BlogContainer.prototype.constructor=BlogContainer;BlogContainer.__superConstructor__=____Class2;function BlogContainer(){"use strict";if(____Class2!==null){____Class2.apply(this,arguments);}}
    Object.defineProperty(BlogContainer.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", {id: "main"}, 
                React.createElement("section", {className: "two"}, 
                    React.createElement("div", {className: "container"}, 
                        React.createElement("header", null, 
                            React.createElement("h2", null, this.props.blog.Title)
                        ), 
                        React.createElement("span", null, this.props.blog.PublishDate), 
                        React.createElement("p", {className: "blog-content"}, React.createElement("span", {dangerouslySetInnerHTML: {__html: this.props.blog.Content}}))
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

