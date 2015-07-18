var ____Classo=React.Component;for(var ____Classo____Key in ____Classo){if(____Classo.hasOwnProperty(____Classo____Key)){BlogArticle[____Classo____Key]=____Classo[____Classo____Key];}}var ____SuperProtoOf____Classo=____Classo===null?null:____Classo.prototype;BlogArticle.prototype=Object.create(____SuperProtoOf____Classo);BlogArticle.prototype.constructor=BlogArticle;BlogArticle.__superConstructor__=____Classo;function BlogArticle(){"use strict";if(____Classo!==null){____Classo.apply(this,arguments);}}
    Object.defineProperty(BlogArticle.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        var getUrl = window.location;
        var baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
        var linkUrl = baseUrl + "/blogs#" +  this.props.item.Url;
        return (
            React.createElement("article", {className: "item"}, 
                React.createElement("a", {href: linkUrl, className: "image fit"}, React.createElement("img", {src: "images/pic03.jpg", alt: ""})), 
                React.createElement("header", null, 
                    React.createElement("h3", null, this.props.item.Title)
                )
            )
        );
    }});


var ____Classp=React.Component;for(var ____Classp____Key in ____Classp){if(____Classp.hasOwnProperty(____Classp____Key)){BlogList[____Classp____Key]=____Classp[____Classp____Key];}}var ____SuperProtoOf____Classp=____Classp===null?null:____Classp.prototype;BlogList.prototype=Object.create(____SuperProtoOf____Classp);BlogList.prototype.constructor=BlogList;BlogList.__superConstructor__=____Classp;function BlogList(){"use strict";if(____Classp!==null){____Classp.apply(this,arguments);}}
    Object.defineProperty(BlogList.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        var ArticlesComponent = this.props.list.map(function(item)  {
            return React.createElement(BlogArticle, {item: item});
        });
        return (
            React.createElement("div", {className: "4u 12u$(mobile)"}, 
                ArticlesComponent
            )
        );
    }});


var ____Classq=React.Component;for(var ____Classq____Key in ____Classq){if(____Classq.hasOwnProperty(____Classq____Key)){BlogListSection[____Classq____Key]=____Classq[____Classq____Key];}}var ____SuperProtoOf____Classq=____Classq===null?null:____Classq.prototype;BlogListSection.prototype=Object.create(____SuperProtoOf____Classq);BlogListSection.prototype.constructor=BlogListSection;BlogListSection.__superConstructor__=____Classq;
    function BlogListSection() {"use strict";
        ____Classq.call(this);
        this.state = {
            blogListCol1: [],
            blogListCol2: [],
            blogListCol3: []
        };
        $.get("http://haimingblogservice.azurewebsites.net/api/Posts", function(data)  {
            var blogs = data.value;
            var index = 0;
            blogs.forEach(function(blog)  {
                _.extend(blog, {index: index});
                index++;
            });
            this.setState({
                blogListCol1: _.filter(blogs, function(blog)  {return blog.index % 3 == 0; }),
                blogListCol2: _.filter(blogs, function(blog)  {return blog.index % 3 == 1; }),
                blogListCol3: _.filter(blogs, function(blog)  {return blog.index % 3 == 2; })
            });
        }.bind(this));
    }

    Object.defineProperty(BlogListSection.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        return (
            React.createElement("section", {id: "blogs", className: "two"}, 
                React.createElement("div", {className: "container"}, 

                    React.createElement("header", null, 
                        React.createElement("h2", null, "Blogs")
                    ), 

                    React.createElement("p", null, "Vitae natoque dictum etiam semper magnis enim feugiat convallis convallis" + ' ' +
                        "egestas rhoncus ridiculus in quis risus amet curabitur tempor orci penatibus." + ' ' +
                        "Tellus erat mauris ipsum fermentum etiam vivamus eget. Nunc nibh morbi quis" + ' ' +
                        "fusce hendrerit lacus ridiculus."), 

                    React.createElement("div", {className: "row"}, 
                        React.createElement(BlogList, {list: this.state.blogListCol1}), 
                        React.createElement(BlogList, {list: this.state.blogListCol2}), 
                        React.createElement(BlogList, {list: this.state.blogListCol3})
                    )

                )
            )
        );
    }});
