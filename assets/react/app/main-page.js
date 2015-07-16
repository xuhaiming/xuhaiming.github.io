var ____Class2=React.Component;for(var ____Class2____Key in ____Class2){if(____Class2.hasOwnProperty(____Class2____Key)){MainPage[____Class2____Key]=____Class2[____Class2____Key];}}var ____SuperProtoOf____Class2=____Class2===null?null:____Class2.prototype;MainPage.prototype=Object.create(____SuperProtoOf____Class2);MainPage.prototype.constructor=MainPage;MainPage.__superConstructor__=____Class2;function MainPage(){"use strict";if(____Class2!==null){____Class2.apply(this,arguments);}}
    Object.defineProperty(MainPage.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("div", null, 
                React.createElement(Header, {isOnMainPage: true}), 
                React.createElement(MainContainer, null), 
                React.createElement(Footer, null)
            )
        );
    }});


React.render(React.createElement(MainPage, null), document.getElementById('main-page'));