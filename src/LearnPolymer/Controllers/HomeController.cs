using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace LearnPolymer.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return Redirect("index.html");
        }

        public IActionResult Error()
        {
            return View();
        }
    }
}
