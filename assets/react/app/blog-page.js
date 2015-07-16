var ____Class3=React.Component;for(var ____Class3____Key in ____Class3){if(____Class3.hasOwnProperty(____Class3____Key)){BlogPage[____Class3____Key]=____Class3[____Class3____Key];}}var ____SuperProtoOf____Class3=____Class3===null?null:____Class3.prototype;BlogPage.prototype=Object.create(____SuperProtoOf____Class3);BlogPage.prototype.constructor=BlogPage;BlogPage.__superConstructor__=____Class3;function BlogPage(){"use strict";if(____Class3!==null){____Class3.apply(this,arguments);}}
    Object.defineProperty(BlogPage.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", null, 
                React.createElement(Header, {isOnMainPage: false}), 
                React.createElement(BlogContainer, null), 
                React.createElement(Footer, null)
            )
        );
    }});


React.render(React.createElement(BlogPage, null), document.getElementById('blog-page'));