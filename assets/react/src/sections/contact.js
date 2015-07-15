class ContactSection extends React.Component {
    render() {
        return (
            <section id="contact" className="four">
                <div className="container">

                    <header>
                        <h2>Contact</h2>
                    </header>

                    <p>You can contact me by filling the information in the form below and
                        click the "Send Message" button. But finally you will find nothing happens.</p>

                    <form method="post" action="#">
                        <div className="row">
                            <div className="6u 12u$(mobile)"><input type="text" name="name" placeholder="Name"/>
                            </div>
                            <div className="6u$ 12u$(mobile)"><input type="text" name="email"
                                                                     placeholder="Email"/></div>
                            <div className="12u$">
                                <textarea name="message" placeholder="Message"></textarea>
                            </div>
                            <div className="12u$">
                                <input type="submit" value="Send Message"/>
                            </div>
                        </div>
                    </form>

                </div>
            </section>
        );
    }
}