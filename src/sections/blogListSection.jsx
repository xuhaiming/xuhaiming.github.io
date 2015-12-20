"use strict";

var React = require('react');
var BlogListConfig = require('../blogListConfig.jsx');

class Article extends React.Component {
    getBlogUrl() {
        var convertedTitle = this.props.title.toLowerCase().replace(/ /g , "-");
        return "blogs/#/" + this.props.date + "-" + convertedTitle;
    }

    render() {
        return (
            <article className="item">
                <a href={this.getBlogUrl()} className="image fit"><img src={"images/thumbnails/" + this.props.thumbnail} alt=""/></a>
                <header>
                    <h3>{this.props.title}</h3>
                </header>
            </article>
        );
    }
}

class BlogListSection extends React.Component {
    constructor() {
        super();
        this.state = {
            displayBlogList: []
        }
    }

    componentDidMount() {
        var displayBlogList = [[],[],[]];
        var coloumIndex = 0;
        BlogListConfig.forEach((blog) => {
            displayBlogList[coloumIndex].push(blog);
            coloumIndex = coloumIndex === 2 ? 0 : coloumIndex + 1;
        });

        this.setState({
            displayBlogList: displayBlogList
        });
    }

    getColumnArticles(columnIndex) {
        if (this.state.displayBlogList.length === 0) return null;
        return this.state.displayBlogList[columnIndex].map((blog) => {
            return <Article key={blog.title} title={blog.title} thumbnail={blog.thumbnail} date={blog.date}/>
        });
    }

    render() {
        return (
            <section id="blogs" className="two">
                <div className="container">

                    <header>
                        <h2>Blogs</h2>
                    </header>

                    <div className="row">
                        <div className="4u 12u$(mobile)">
                            {this.getColumnArticles(0)}
                        </div>
                        <div className="4u 12u$(mobile)">
                            {this.getColumnArticles(1)}
                        </div>
                        <div className="4u$ 12u$(mobile)">
                            {this.getColumnArticles(2)}
                        </div>
                    </div>

                </div>
            </section>
        )
    }
}

module.exports = BlogListSection;
