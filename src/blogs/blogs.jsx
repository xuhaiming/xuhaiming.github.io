"use strict";

var React = require('react');
var ReactDOM = require('react-dom');
var $ = require('jquery');

require('../sass/style.scss');

var Header = require('../sections/header.jsx');
var BlogContent = require('./blogContent.jsx');
var Footer = require('../sections/footer.jsx');


class BlogPage extends React.Component {
    constructor() {
        super();
        this.state = {
            htmlContent: null
        }
    }

    componentDidMount() {
        $.get("2015-12-20-about-my-website.html", (htmlContent) => {
            this.setState({htmlContent: htmlContent});
        });
    }

    render() {
        return (
            <div>
                <Header isRootPage={false}/>
                <BlogContent content={this.state.htmlContent}/>
                <Footer />
            </div>
        );
    }
}

ReactDOM.render(
    <BlogPage />,
    document.getElementById('blog-page')
);