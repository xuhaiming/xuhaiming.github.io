var ____Classi=React.Component;for(var ____Classi____Key in ____Classi){if(____Classi.hasOwnProperty(____Classi____Key)){BlogContainer[____Classi____Key]=____Classi[____Classi____Key];}}var ____SuperProtoOf____Classi=____Classi===null?null:____Classi.prototype;BlogContainer.prototype=Object.create(____SuperProtoOf____Classi);BlogContainer.prototype.constructor=BlogContainer;BlogContainer.__superConstructor__=____Classi;function BlogContainer(){"use strict";if(____Classi!==null){____Classi.apply(this,arguments);}}
    Object.defineProperty(BlogContainer.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        var publishDate = moment(this.props.blog.PublishDate).format('MMMM DD, YYYY');
        return (
            React.createElement("div", {id: "main"}, 
                React.createElement("section", {className: "two"}, 
                    React.createElement("div", {className: "container"}, 
                        React.createElement("header", null, 
                            React.createElement("h2", null, this.props.blog.Title)
                        ), 
                        React.createElement("p", null, publishDate), 
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

