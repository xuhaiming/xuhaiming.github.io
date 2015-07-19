var ____Class0=React.Component;for(var ____Class0____Key in ____Class0){if(____Class0.hasOwnProperty(____Class0____Key)){BlogArticle[____Class0____Key]=____Class0[____Class0____Key];}}var ____SuperProtoOf____Class0=____Class0===null?null:____Class0.prototype;BlogArticle.prototype=Object.create(____SuperProtoOf____Class0);BlogArticle.prototype.constructor=BlogArticle;BlogArticle.__superConstructor__=____Class0;function BlogArticle(){"use strict";if(____Class0!==null){____Class0.apply(this,arguments);}}
    Object.defineProperty(BlogArticle.prototype,"render",{writable:true,configurable:true,value:function() {"use strict";
        var getUrl = window.location;
        var baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
        var linkUrl = baseUrl + "/blogs/#/" +  this.props.item.Url;
        return (
            React.createElement("article", {className: "item"}, 
                React.createElement("a", {href: linkUrl, className: "image fit"}, React.createElement("img", {src: "images/thumbnails/" + this.props.item.Url + ".png", alt: ""})), 
                React.createElement("header", null, 
                    React.createElement("h3", null, this.props.item.Title)
                )
            )
        );
    }});


var ____Class1=React.Component;for(var ____Class1____Key in ____Class1){if(____Class1.hasOwnProperty(____Class1____Key)){BlogList[____Class1____Key]=____Class1[____Class1____Key];}}var ____SuperProtoOf____Class1=____Class1===null?null:____Class1.prototype;BlogList.prototype=Object.create(____SuperProtoOf____Class1);BlogList.prototype.constructor=BlogList;BlogList.__superConstructor__=____Class1;function BlogList(){"use strict";if(____Class1!==null){____Class1.apply(this,arguments);}}
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


var ____Class2=React.Component;for(var ____Class2____Key in ____Class2){if(____Class2.hasOwnProperty(____Class2____Key)){BlogListSection[____Class2____Key]=____Class2[____Class2____Key];}}var ____SuperProtoOf____Class2=____Class2===null?null:____Class2.prototype;BlogListSection.prototype=Object.create(____SuperProtoOf____Class2);BlogListSection.prototype.constructor=BlogListSection;BlogListSection.__superConstructor__=____Class2;
    function BlogListSection() {"use strict";
        ____Class2.call(this);
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
