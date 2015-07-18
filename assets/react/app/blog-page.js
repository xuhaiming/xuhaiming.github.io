var ____Class1=React.Component;for(var ____Class1____Key in ____Class1){if(____Class1.hasOwnProperty(____Class1____Key)){BlogPage[____Class1____Key]=____Class1[____Class1____Key];}}var ____SuperProtoOf____Class1=____Class1===null?null:____Class1.prototype;BlogPage.prototype=Object.create(____SuperProtoOf____Class1);BlogPage.prototype.constructor=BlogPage;BlogPage.__superConstructor__=____Class1;
    function BlogPage() {"use strict";
        ____Class1.call(this);
        this.state = {
            blog: {}
        };
    }

    Object.defineProperty(BlogPage.prototype,"initializeRoute",{writable:true,configurable:true,value:function() {"use strict";
        var viewBlog = function (blogId) {
            $.get("http://haimingblogservice.azurewebsites.net/api/Posts?$filter=Url eq '" + blogId + "'", function(data)  {
                this.setState({
                    blog: data.value[0]
                });
            }.bind(this));
        }.bind(this);

        var routes = {
            '/:blogId': viewBlog
        };

        var router = Router(routes);

        router.init();
    }});

    Object.defineProperty(BlogPage.prototype,"componentDidMount",{writable:true,configurable:true,value:function() {"use strict";
        this.initializeRoute();
    }});

    Object.defineProperty(BlogPage.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", null, 
                React.createElement(Header, {isOnMainPage: false}), 
                React.createElement(BlogContainer, {blog: this.state.blog}), 
                React.createElement(Footer, null)
            )
        );
    }});


React.render(React.createElement(BlogPage, null), document.getElementById('blog-page'));