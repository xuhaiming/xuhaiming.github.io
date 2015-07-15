var ____Classm=React.Component;for(var ____Classm____Key in ____Classm){if(____Classm.hasOwnProperty(____Classm____Key)){MainPage[____Classm____Key]=____Classm[____Classm____Key];}}var ____SuperProtoOf____Classm=____Classm===null?null:____Classm.prototype;MainPage.prototype=Object.create(____SuperProtoOf____Classm);MainPage.prototype.constructor=MainPage;MainPage.__superConstructor__=____Classm;
    Object.defineProperty(MainPage.prototype,"initializeRoute",{writable:true,configurable:true,value:function() {"use strict";
        var viewBlogs = function (blogId) {
            this.setState({
                onMainContainer: false
            });
        }.bind(this);

        var routes = {
            '/blogs/:blogId': viewBlogs
        };

        var router = Router(routes);

        router.init();
    }});

    function MainPage() {"use strict";
        ____Classm.call(this);
        this.initializeRoute();
        this.state = {
            onMainContainer: true
        };
    }

    Object.defineProperty(MainPage.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", null, 
                React.createElement(Header, {isOnHomePage: this.state.onMainContainer}), 
                this.state.onMainContainer ? React.createElement(MainContainer, null) : React.createElement(BlogContainer, null), 
                React.createElement(Footer, null)
            )
        );
    }});


React.render(React.createElement(MainPage, null), document.getElementById('main-page'));